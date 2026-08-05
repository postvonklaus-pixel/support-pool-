"""
Taeglicher Workflow: laeuft NUR fuer aktive Abos (inkl. Grace-Period).

Vor jedem Agenten-Schritt wird geprueft, ob der User noch bezahlt (bzw.
innerhalb der 7-Tage-Grace-Period) ist. Faellt die Zahlung endgueltig aus
(Grace-Period abgelaufen), werden die Agenten deaktiviert (User wird
"expired" -> nur Lesezugriff) und eine Benachrichtigung verschickt.
"""
import logging
from datetime import datetime

from agents import build_agents
from agents.base_agent import AgentAccessDenied
from config import AGENT_ANALYTICS, AGENT_CONTENT_CREATOR, AGENT_ENGAGEMENT, AGENT_GROWTH, AGENT_PUBLISHER
from db import get_session
from email_service import send_payment_reminder
from mrr import daily_mrr_report
from models import SubscriptionStatusEnum, User, enum_value

logger = logging.getLogger(__name__)

# Reihenfolge, in der die Agenten pro User taeglich durchlaufen werden.
PIPELINE_ORDER = [AGENT_CONTENT_CREATOR, AGENT_PUBLISHER, AGENT_ENGAGEMENT, AGENT_ANALYTICS, AGENT_GROWTH]


def _expire_if_grace_period_over(user: User) -> bool:
    """Setzt den User auf 'expired', wenn die Grace-Period nach einem Zahlungsfehlschlag abgelaufen ist.

    Gibt True zurueck, wenn der User dadurch gerade neu abgelaufen ist.
    """
    if (
        user.subscription_status == SubscriptionStatusEnum.past_due.value
        and user.grace_period_ends_at is not None
        and datetime.utcnow() > user.grace_period_ends_at
    ):
        user.subscription_status = SubscriptionStatusEnum.expired.value
        return True
    return False


def _is_billable_active(user: User) -> bool:
    """True, wenn der User aktuell Agenten laufen lassen darf (aktiv oder in Grace-Period)."""
    return user.subscription_status in (
        SubscriptionStatusEnum.active.value,
        SubscriptionStatusEnum.trialing.value,
        SubscriptionStatusEnum.past_due.value,
    )


def run_user_pipeline(user: User, agents: dict) -> dict:
    """Fuehrt alle fuer den User freigeschalteten Agenten in der Pipeline-Reihenfolge aus."""
    results = {}
    for agent_id in PIPELINE_ORDER:
        if agent_id not in (user.agent_access or []):
            continue
        agent = agents[agent_id]
        try:
            results[agent_id] = agent.run(user)
        except AgentAccessDenied as exc:
            logger.warning("Zugriff verweigert fuer user_id=%s agent=%s: %s", user.id, agent_id, exc)
            results[agent_id] = {"error": "access_denied"}
        except Exception:
            logger.exception("Fehler beim Ausfuehren von agent=%s fuer user_id=%s", agent_id, user.id)
            results[agent_id] = {"error": "exception"}
    return results


def daily_workflow(agents: dict | None = None) -> dict:
    """
    Haupteinstiegspunkt des taeglichen Workflows.

    1. Prueft fuer jeden User den Zahlungsstatus (inkl. Grace-Period-Ablauf).
    2. Fuehrt fuer aktive Abos die freigeschalteten Agenten aus.
    3. Erstellt den taeglichen MRR-Report.
    """
    agents = agents or build_agents()
    summary = {"processed": 0, "skipped_expired": 0, "newly_expired": 0, "errors": 0}

    with get_session() as session:
        users = session.query(User).all()
        newly_expired_emails = []

        for user in users:
            became_expired = _expire_if_grace_period_over(user)
            if became_expired:
                summary["newly_expired"] += 1
                newly_expired_emails.append(user.email)

            if not _is_billable_active(user):
                summary["skipped_expired"] += 1
                logger.info(
                    "User %s uebersprungen (status=%s) -> nur Lesezugriff, keine Agenten-Ausfuehrung.",
                    user.email, enum_value(user.subscription_status),
                )
                continue

        session.flush()
        # Liste der User-IDs, fuer die die Pipeline laeuft, ausserhalb der
        # Session-Transaktion sammeln (Agenten oeffnen ihre eigenen Sessions).
        active_user_ids = [
            u.id for u in users
            if _is_billable_active(u)
        ]

    for email in newly_expired_emails:
        send_payment_reminder(email, days_left=0)

    for user_id in active_user_ids:
        with get_session() as session:
            user = session.get(User, user_id)
            if user is None:
                continue
            user_snapshot = user
            try:
                run_user_pipeline(user_snapshot, agents)
                summary["processed"] += 1
            except Exception:
                logger.exception("Workflow-Fehler fuer user_id=%s", user_id)
                summary["errors"] += 1

    summary["mrr"] = daily_mrr_report()
    logger.info("Taeglicher Workflow abgeschlossen: %s", summary)
    return summary


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    daily_workflow()
