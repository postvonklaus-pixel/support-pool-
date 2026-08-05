"""
Erstellt Test-Daten: 5 User mit je einem der 4 Plaene, plus ein abgelaufener User.

- user_starter@test.com  (Starter, aktiv)
- user_creator@test.com  (Creator, aktiv)
- user_pro@test.com      (Pro, aktiv)
- user_agent@test.com    (Agent, aktiv)
- user_expired@test.com  (Starter-Plan, Abo abgelaufen -> read-only)

Wird automatisch von main.py aufgerufen, wenn die DB leer ist, und kann
auch direkt mit "python seed.py" ausgefuehrt werden.
"""
import logging
from datetime import datetime, timedelta

from auth import hash_password
from config import GRACE_PERIOD_DAYS, PLAN_CONFIG, PlanTier
from db import get_session, init_db
from models import SubscriptionStatusEnum, User

logger = logging.getLogger(__name__)

DEFAULT_PASSWORD = "testpassword123"

SEED_USERS = [
    {"email": "user_starter@test.com", "plan": PlanTier.STARTER, "status": SubscriptionStatusEnum.active},
    {"email": "user_creator@test.com", "plan": PlanTier.CREATOR, "status": SubscriptionStatusEnum.active},
    {"email": "user_pro@test.com", "plan": PlanTier.PRO, "status": SubscriptionStatusEnum.active},
    {"email": "user_agent@test.com", "plan": PlanTier.AGENT, "status": SubscriptionStatusEnum.active},
    # Abgelaufen: Grace-Period ist bereits verstrichen -> nur Lesezugriff.
    {"email": "user_expired@test.com", "plan": PlanTier.STARTER, "status": SubscriptionStatusEnum.expired},
]


def _build_user(email: str, plan: PlanTier, status: SubscriptionStatusEnum) -> User:
    cfg = PLAN_CONFIG[plan]
    user = User(
        email=email,
        password_hash=hash_password(DEFAULT_PASSWORD),
        plan=plan.value,
        platform_limit=cfg["platform_limit"],
        post_limit=cfg["post_limit"],
        video_limit=cfg["video_limit"],
        agent_access=list(cfg["agents"]),
        subscription_status=status.value,
        stripe_customer_id=f"cus_mock_{email.split('@')[0]}",
        stripe_subscription_id=f"sub_mock_{email.split('@')[0]}",
    )
    if status == SubscriptionStatusEnum.past_due:
        user.payment_failed_at = datetime.utcnow() - timedelta(days=1)
        user.grace_period_ends_at = datetime.utcnow() + timedelta(days=GRACE_PERIOD_DAYS - 1)
    elif status == SubscriptionStatusEnum.expired:
        user.payment_failed_at = datetime.utcnow() - timedelta(days=GRACE_PERIOD_DAYS + 5)
        user.grace_period_ends_at = datetime.utcnow() - timedelta(days=5)
    return user


def seed_users(force: bool = False) -> list:
    """Legt die 5 Test-User an. Ueberspringt bereits existierende E-Mails, es sei denn force=True."""
    created = []
    with get_session() as session:
        for entry in SEED_USERS:
            existing = session.query(User).filter_by(email=entry["email"]).first()
            if existing and not force:
                logger.info("Seed: User %s existiert bereits, ueberspringe.", entry["email"])
                continue
            if existing and force:
                session.delete(existing)
                session.flush()
            user = _build_user(entry["email"], entry["plan"], entry["status"])
            session.add(user)
            created.append(entry["email"])
        session.flush()
    if created:
        logger.info("Seed: %d Test-User angelegt: %s", len(created), ", ".join(created))
    return created


def has_users() -> bool:
    with get_session() as session:
        return session.query(User).first() is not None


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    init_db()
    seed_users()
