"""
Stripe-Integration fuer Abo-Zahlungen.

Laeuft komplett im MOCK-Modus, wenn kein echter STRIPE_SECRET_KEY gesetzt ist
(config.MOCK_STRIPE). Im Mock-Modus werden keine echten HTTP-Calls an Stripe
gemacht - stattdessen werden plausible Fake-Objekte erzeugt und direkt in der
lokalen Datenbank verbucht. Das erlaubt "python cli.py ..." / "python main.py"
ohne jeden Stripe-Account.

TODO: Fuer echten Betrieb "stripe" SDK konfigurieren (stripe.api_key) und
Stripe-CLI ("stripe listen --forward-to localhost:4242/webhook") fuer lokale
Webhook-Tests nutzen (siehe README).
"""
import logging
import uuid
from datetime import datetime, timedelta
from typing import Optional

from config import (
    GRACE_PERIOD_DAYS,
    MOCK_STRIPE,
    PLAN_CONFIG,
    STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET,
    PlanTier,
)
from db import get_session
from email_service import (
    send_cancellation_confirmation,
    send_payment_reminder,
    send_upgrade_confirmation,
)
from models import (
    Content,
    ContentStatusEnum,
    ContentTypeEnum,
    Payment,
    PaymentStatusEnum,
    SubscriptionStatusEnum,
    User,
    enum_value,
)

logger = logging.getLogger(__name__)

if not MOCK_STRIPE:
    import stripe

    stripe.api_key = STRIPE_SECRET_KEY
else:
    stripe = None  # type: ignore


class PaymentError(Exception):
    pass


def _plan_enum(plan: str) -> PlanTier:
    return plan if isinstance(plan, PlanTier) else PlanTier(plan)


# --------------------------------------------------------------------------
# Checkout
# --------------------------------------------------------------------------
def create_checkout_session(user_id: int, plan: str) -> dict:
    """Erstellt eine Stripe Checkout Session fuer den Plan-Kauf/-Wechsel."""
    plan_tier = _plan_enum(plan)
    cfg = PLAN_CONFIG[plan_tier]

    with get_session() as session:
        user = session.get(User, user_id)
        if not user:
            raise PaymentError(f"User {user_id} nicht gefunden")

        if MOCK_STRIPE:
            fake_session_id = f"cs_mock_{uuid.uuid4().hex[:16]}"
            checkout_url = f"https://mock-checkout.local/pay/{fake_session_id}"
            logger.info(
                "[MOCK] Checkout-Session fuer user_id=%s plan=%s erstellt (%s)",
                user_id, plan_tier.value, fake_session_id,
            )
            if not user.stripe_customer_id:
                user.stripe_customer_id = f"cus_mock_{uuid.uuid4().hex[:12]}"
            return {
                "id": fake_session_id,
                "url": checkout_url,
                "mode": "subscription",
                "plan": plan_tier.value,
                "amount_usd": cfg["price_usd"],
                "mock": True,
            }

        # TODO: echte Stripe Price-IDs pro Plan hinterlegen (z.B. via .env
        # STRIPE_PRICE_STARTER etc.) statt price_data inline zu erzeugen.
        checkout = stripe.checkout.Session.create(
            mode="subscription",
            customer=user.stripe_customer_id or None,
            customer_email=None if user.stripe_customer_id else user.email,
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {"name": f"Social Media Automation - {cfg['name']}"},
                    "unit_amount": int(cfg["price_usd"] * 100),
                    "recurring": {"interval": "month"},
                },
                "quantity": 1,
            }],
            success_url="https://example.com/checkout/success?session_id={CHECKOUT_SESSION_ID}",
            cancel_url="https://example.com/checkout/cancel",
            metadata={"user_id": str(user_id), "plan": plan_tier.value},
        )
        return {"id": checkout.id, "url": checkout.url, "mode": "subscription", "plan": plan_tier.value, "mock": False}


# --------------------------------------------------------------------------
# Webhook-Handling
# --------------------------------------------------------------------------
def handle_webhook(payload: bytes, sig_header: Optional[str] = None) -> dict:
    """
    Verarbeitet ein Stripe-Webhook-Event.

    Im MOCK-Modus wird die Signatur NICHT geprueft (payload wird direkt als
    JSON-Event interpretiert) - praktisch fuer lokale Tests mit curl/requests.
    """
    import json

    if MOCK_STRIPE:
        event = json.loads(payload)
    else:
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
        except (ValueError, stripe.error.SignatureVerificationError) as exc:
            raise PaymentError(f"Ungueltiger Webhook: {exc}") from exc

    event_type = event.get("type")
    data_obj = event.get("data", {}).get("object", {})
    logger.info("Stripe-Webhook empfangen: %s", event_type)

    if event_type == "checkout.session.completed":
        _handle_checkout_completed(data_obj)
    elif event_type == "invoice.payment_succeeded":
        _handle_invoice_paid(data_obj)
    elif event_type == "invoice.payment_failed":
        _handle_invoice_failed(data_obj)
    elif event_type == "customer.subscription.deleted":
        _handle_subscription_deleted(data_obj)
    else:
        logger.info("Webhook-Event %s wird nicht behandelt, ignoriere.", event_type)

    return {"status": "handled", "type": event_type}


def _find_user_by_metadata_or_customer(session, data_obj) -> Optional[User]:
    user_id = (data_obj.get("metadata") or {}).get("user_id")
    if user_id:
        user = session.get(User, int(user_id))
        if user:
            return user
    customer_id = data_obj.get("customer")
    if customer_id:
        return session.query(User).filter_by(stripe_customer_id=customer_id).first()
    return None


def _handle_checkout_completed(data_obj: dict) -> None:
    with get_session() as session:
        user = _find_user_by_metadata_or_customer(session, data_obj)
        if not user:
            logger.warning("checkout.session.completed: kein User gefunden fuer %s", data_obj.get("id"))
            return

        plan = (data_obj.get("metadata") or {}).get("plan")
        if plan:
            _apply_plan(user, PlanTier(plan))

        user.subscription_status = SubscriptionStatusEnum.active.value
        user.payment_failed_at = None
        user.grace_period_ends_at = None
        user.stripe_customer_id = data_obj.get("customer") or user.stripe_customer_id
        user.stripe_subscription_id = data_obj.get("subscription") or user.stripe_subscription_id

        session.add(Payment(
            user_id=user.id,
            stripe_invoice_id=data_obj.get("id", f"cs_{uuid.uuid4().hex[:12]}"),
            amount=PLAN_CONFIG[PlanTier(user.plan)]["price_usd"],
            currency="usd",
            status=PaymentStatusEnum.paid.value,
            plan_at_time=user.plan,
            billing_period_start=datetime.utcnow(),
            billing_period_end=datetime.utcnow() + timedelta(days=30),
        ))


def _handle_invoice_paid(data_obj: dict) -> None:
    with get_session() as session:
        user = _find_user_by_metadata_or_customer(session, data_obj)
        if not user:
            logger.warning("invoice.payment_succeeded: kein User gefunden")
            return
        user.subscription_status = SubscriptionStatusEnum.active.value
        user.payment_failed_at = None
        user.grace_period_ends_at = None
        session.add(Payment(
            user_id=user.id,
            stripe_invoice_id=data_obj.get("id", f"in_{uuid.uuid4().hex[:12]}"),
            amount=(data_obj.get("amount_paid", 0) / 100) or PLAN_CONFIG[PlanTier(user.plan)]["price_usd"],
            currency=data_obj.get("currency", "usd"),
            status=PaymentStatusEnum.paid.value,
            plan_at_time=user.plan,
            billing_period_start=datetime.utcnow(),
            billing_period_end=datetime.utcnow() + timedelta(days=30),
        ))


def _handle_invoice_failed(data_obj: dict) -> None:
    """Zahlung fehlgeschlagen -> Status past_due, 7-Tage-Grace-Period startet."""
    with get_session() as session:
        user = _find_user_by_metadata_or_customer(session, data_obj)
        if not user:
            logger.warning("invoice.payment_failed: kein User gefunden")
            return
        user.subscription_status = SubscriptionStatusEnum.past_due.value
        user.payment_failed_at = datetime.utcnow()
        user.grace_period_ends_at = datetime.utcnow() + timedelta(days=GRACE_PERIOD_DAYS)
        session.add(Payment(
            user_id=user.id,
            stripe_invoice_id=data_obj.get("id", f"in_{uuid.uuid4().hex[:12]}"),
            amount=(data_obj.get("amount_due", 0) / 100) or PLAN_CONFIG[PlanTier(user.plan)]["price_usd"],
            currency=data_obj.get("currency", "usd"),
            status=PaymentStatusEnum.failed.value,
            plan_at_time=user.plan,
        ))
        email = user.email
    send_payment_reminder(email, days_left=GRACE_PERIOD_DAYS)


def _handle_subscription_deleted(data_obj: dict) -> None:
    with get_session() as session:
        user = _find_user_by_metadata_or_customer(session, data_obj)
        if not user:
            logger.warning("customer.subscription.deleted: kein User gefunden")
            return
        user.subscription_status = SubscriptionStatusEnum.canceled.value


# --------------------------------------------------------------------------
# Subscription-Management
# --------------------------------------------------------------------------
def cancel_subscription(user_id: int) -> dict:
    with get_session() as session:
        user = session.get(User, user_id)
        if not user:
            raise PaymentError(f"User {user_id} nicht gefunden")

        if not MOCK_STRIPE and user.stripe_subscription_id:
            stripe.Subscription.delete(user.stripe_subscription_id)
        else:
            logger.info("[MOCK] Kuendige Subscription fuer user_id=%s", user_id)

        user.subscription_status = SubscriptionStatusEnum.canceled.value
        email = user.email

    send_cancellation_confirmation(email)
    return {"status": "canceled", "user_id": user_id}


def upgrade_plan(user_id: int, new_plan: str) -> dict:
    """Wechselt den Plan eines Users (Upgrade oder Downgrade) sofort."""
    new_plan_tier = _plan_enum(new_plan)
    cfg = PLAN_CONFIG[new_plan_tier]

    with get_session() as session:
        user = session.get(User, user_id)
        if not user:
            raise PaymentError(f"User {user_id} nicht gefunden")

        old_plan = enum_value(user.plan)
        if not MOCK_STRIPE and user.stripe_subscription_id:
            # TODO: echtes stripe.Subscription.modify() mit neuer Price-ID.
            pass
        else:
            logger.info("[MOCK] Plan-Wechsel user_id=%s: %s -> %s", user_id, old_plan, new_plan_tier.value)

        _apply_plan(user, new_plan_tier)
        user.subscription_status = SubscriptionStatusEnum.active.value
        user.payment_failed_at = None
        user.grace_period_ends_at = None

        session.add(Payment(
            user_id=user.id,
            stripe_invoice_id=f"upgrade_{uuid.uuid4().hex[:12]}",
            amount=cfg["price_usd"],
            currency="usd",
            status=PaymentStatusEnum.paid.value,
            plan_at_time=new_plan_tier.value,
            billing_period_start=datetime.utcnow(),
            billing_period_end=datetime.utcnow() + timedelta(days=30),
        ))
        email = user.email

    send_upgrade_confirmation(email, old_plan, new_plan_tier.value)
    return {"status": "upgraded", "user_id": user_id, "old_plan": old_plan, "new_plan": new_plan_tier.value}


def _apply_plan(user: User, plan_tier: PlanTier) -> None:
    cfg = PLAN_CONFIG[plan_tier]
    user.plan = plan_tier.value
    user.platform_limit = cfg["platform_limit"]
    user.post_limit = cfg["post_limit"]
    user.video_limit = cfg["video_limit"]
    user.agent_access = list(cfg["agents"])


# --------------------------------------------------------------------------
# Reporting
# --------------------------------------------------------------------------
def get_invoice_history(user_id: int) -> list:
    with get_session() as session:
        payments = (
            session.query(Payment)
            .filter_by(user_id=user_id)
            .order_by(Payment.created_at.desc())
            .all()
        )
        return [
            {
                "id": p.id,
                "stripe_invoice_id": p.stripe_invoice_id,
                "amount": p.amount,
                "currency": p.currency,
                "status": enum_value(p.status),
                "plan_at_time": p.plan_at_time,
                "billing_period_start": p.billing_period_start,
                "billing_period_end": p.billing_period_end,
                "created_at": p.created_at,
            }
            for p in payments
        ]


def check_plan_limits(user_id: int) -> dict:
    """
    Prueft den aktuellen Verbrauch eines Users gegen seine Plan-Limits.

    Rueckgabe enthaelt platform_count, post_count, video_count, agent_count
    (jeweils aktueller Verbrauch) sowie die zugehoerigen *_limit-Werte.
    """
    with get_session() as session:
        user = session.get(User, user_id)
        if not user:
            raise PaymentError(f"User {user_id} nicht gefunden")

        month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Nur VEROEFFENTLICHTER Content zaehlt gegen das Monats-Limit - das
        # entspricht der Durchsetzung in agents/publisher.py (Entwuerfe
        # duerfen unbegrenzt erstellt werden, das Limit greift erst beim
        # tatsaechlichen Veroeffentlichen).
        published_this_month = (
            session.query(Content)
            .filter(
                Content.user_id == user_id,
                Content.status == ContentStatusEnum.published.value,
                Content.published_at >= month_start,
            )
            .all()
        )

        platform_count = len({c.platform for c in published_this_month})
        post_count = len([c for c in published_this_month if c.content_type != ContentTypeEnum.video.value
                           and c.content_type != ContentTypeEnum.reel.value])
        video_count = len([c for c in published_this_month if c.content_type in
                            (ContentTypeEnum.video.value, ContentTypeEnum.reel.value)])
        agent_count = len(user.agent_access or [])

        return {
            "user_id": user_id,
            "plan": enum_value(user.plan),
            "platform_count": platform_count,
            "platform_limit": user.platform_limit,
            "post_count": post_count,
            "post_limit": user.post_limit,
            "video_count": video_count,
            "video_limit": user.video_limit,
            "agent_count": agent_count,
            "agent_limit": len(PLAN_CONFIG[_plan_enum(user.plan)]["agents"]),
            "subscription_status": enum_value(user.subscription_status),
            "is_read_only": user.is_read_only(),
        }
