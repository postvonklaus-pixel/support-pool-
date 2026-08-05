"""
MRR-Tracking (Monthly Recurring Revenue).

MRR = (User_Starter * 29) + (User_Creator * 99) + (User_Pro * 299) + (User_Agent * 999)

Nur User mit aktivem oder in der Grace-Period befindlichem Abo
(active, trialing, past_due) zaehlen zum MRR - expired/canceled nicht.
"""
import logging
from calendar import monthrange
from datetime import date, datetime, timedelta

from config import (
    MRR_GOAL_DAYS,
    MRR_GOAL_START_DATE,
    MRR_GOAL_TARGET_USD,
    MRR_TARGET_MONTHLY,
    PLAN_CONFIG,
    PlanTier,
    SELF_SERVICE_PLANS,
)
from db import get_session
from models import SubscriptionStatusEnum, User, enum_value

logger = logging.getLogger(__name__)

_COUNTING_STATUSES = (
    SubscriptionStatusEnum.active.value,
    SubscriptionStatusEnum.trialing.value,
    SubscriptionStatusEnum.past_due.value,
)


def compute_mrr() -> dict:
    """Zaehlt User pro Plan und berechnet den gesamten MRR."""
    counts = {tier.value: 0 for tier in PlanTier}
    with get_session() as session:
        users = session.query(User).filter(User.subscription_status.in_(_COUNTING_STATUSES)).all()
        for user in users:
            plan = enum_value(user.plan)
            if plan in counts:
                counts[plan] += 1
        user_count = len(users)

    mrr_total = sum(counts[tier.value] * PLAN_CONFIG[tier]["price_usd"] for tier in PlanTier)

    return {
        "counts": counts,
        "mrr_total": mrr_total,
        "user_count": user_count,
    }


def get_daily_target(today: datetime | None = None) -> float:
    """Lineare Umlegung des Monats-Ziels (MRR_TARGET_MONTHLY) auf den aktuellen Tag im Monat."""
    today = today or datetime.utcnow()
    days_in_month = monthrange(today.year, today.month)[1]
    return round(MRR_TARGET_MONTHLY * (today.day / days_in_month), 2)


def daily_mrr_report() -> dict:
    """Erstellt den taeglichen MRR-Report und loggt einen Alarm, falls unter Ziel."""
    stats = compute_mrr()
    target = get_daily_target()
    alarm = stats["mrr_total"] < target

    report = {**stats, "target": target, "alarm": alarm}

    logger.info(
        "MRR-Report: total=$%s | Starter=%d Creator=%d Pro=%d Agent=%d | Ziel=$%s",
        stats["mrr_total"], stats["counts"]["starter"], stats["counts"]["creator"],
        stats["counts"]["pro"], stats["counts"]["agent"], target,
    )
    if alarm:
        logger.warning(
            "MRR-ALARM: aktueller MRR $%s liegt unter dem Tagesziel von $%s!",
            stats["mrr_total"], target,
        )
    return report


def _goal_start_date() -> date:
    if MRR_GOAL_START_DATE:
        return date.fromisoformat(MRR_GOAL_START_DATE)
    return date.today()


def mrr_goal_progress() -> dict:
    """
    Fortschritt Richtung Wachstumsziel (z.B. $50.000 MRR in 90 Tagen, siehe
    config.MRR_GOAL_*). Liefert Tage bis Ziel sowie, wie viele neue User pro
    Tag (je nach Plan) noetig waeren, um die Luecke bis zum Ziel-Datum zu
    schliessen - als Alternativ-Szenarien pro Plan, nicht als fixe Mischung.
    """
    start = _goal_start_date()
    deadline = start + timedelta(days=MRR_GOAL_DAYS)
    today = date.today()
    days_left = max((deadline - today).days, 0)
    days_elapsed = min(max((today - start).days, 0), MRR_GOAL_DAYS)

    current_usd = compute_mrr()["mrr_total"]
    remaining_usd = max(MRR_GOAL_TARGET_USD - current_usd, 0)
    expected_by_now = MRR_GOAL_TARGET_USD * (days_elapsed / MRR_GOAL_DAYS) if MRR_GOAL_DAYS else 0
    on_track = current_usd >= expected_by_now

    needed_per_day_usd = remaining_usd / days_left if days_left > 0 else remaining_usd

    users_per_day_by_plan = {
        tier.value: round(needed_per_day_usd / PLAN_CONFIG[tier]["price_usd"], 2)
        for tier in SELF_SERVICE_PLANS
    }

    return {
        "target_usd": MRR_GOAL_TARGET_USD,
        "current_usd": current_usd,
        "remaining_usd": round(remaining_usd, 2),
        "days_total": MRR_GOAL_DAYS,
        "days_elapsed": days_elapsed,
        "days_left": days_left,
        "deadline": deadline.isoformat(),
        "needed_per_day_usd": round(needed_per_day_usd, 2),
        "users_per_day_by_plan": users_per_day_by_plan,
        "on_track": on_track,
    }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(daily_mrr_report())
    print(mrr_goal_progress())
