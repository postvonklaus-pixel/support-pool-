"""
SQLAlchemy-Datenbankmodelle: User, Content, Analytics, Payment.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum as SAEnum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.types import JSON

Base = declarative_base()


def gen_uuid() -> str:
    return str(uuid.uuid4())


def enum_value(value):
    """Gibt den rohen String-Wert eines (str-mixed) Enums zurueck, egal ob
    ein Enum-Member oder bereits ein plain str uebergeben wird.

    Wichtig fuer Anzeige/Logging: str(SomeStrEnum.member) liefert je nach
    Python-Version "ClassName.member" statt des eigentlichen Werts - direkte
    f-string-Interpolation von Enum-Spalten daher immer ueber diese Funktion.
    """
    return value.value if hasattr(value, "value") else value


class PlanEnum(str, enum.Enum):
    starter = "starter"
    creator = "creator"
    pro = "pro"
    agent = "agent"
    beta = "beta"


class SubscriptionStatusEnum(str, enum.Enum):
    active = "active"
    trialing = "trialing"
    past_due = "past_due"
    canceled = "canceled"
    expired = "expired"


class ContentTypeEnum(str, enum.Enum):
    post = "post"
    carousel = "carousel"
    thread = "thread"
    video = "video"
    reel = "reel"


class ContentStatusEnum(str, enum.Enum):
    draft = "draft"
    scheduled = "scheduled"
    published = "published"
    failed = "failed"


class PaymentStatusEnum(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    failed = "failed"
    refunded = "refunded"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)

    plan = Column(SAEnum(PlanEnum), nullable=False, default=PlanEnum.starter)

    platform_limit = Column(Integer, nullable=False, default=1)
    post_limit = Column(Integer, nullable=False, default=10)  # -1 = unbegrenzt
    video_limit = Column(Integer, nullable=False, default=0)  # -1 = unbegrenzt
    agent_access = Column(JSON, nullable=False, default=list)  # Liste der Agenten-IDs

    # Abo-/Zahlungsstatus (fuer Grace-Period-Logik in workflow.py)
    subscription_status = Column(
        SAEnum(SubscriptionStatusEnum), nullable=False, default=SubscriptionStatusEnum.active
    )
    payment_failed_at = Column(DateTime, nullable=True)
    grace_period_ends_at = Column(DateTime, nullable=True)

    stripe_customer_id = Column(String(255), nullable=True)
    stripe_subscription_id = Column(String(255), nullable=True)

    # Beta-/Onboarding-Tracking (Phase 2): wann zuletzt eingeloggt, um
    # inaktive Beta-Tester im Admin-Dashboard erkennen zu koennen.
    last_login_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    contents = relationship("Content", back_populates="user", cascade="all, delete-orphan")
    analytics = relationship("Analytics", back_populates="user", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="user", cascade="all, delete-orphan")
    feedback_entries = relationship("Feedback", back_populates="user", cascade="all, delete-orphan")
    engagement_replies = relationship("EngagementReply", back_populates="user", cascade="all, delete-orphan")
    growth_strategies = relationship("GrowthStrategy", back_populates="user", cascade="all, delete-orphan")

    def is_read_only(self) -> bool:
        """Bei abgelaufenem Abo: nur noch Lesezugriff, keine neuen Posts."""
        return self.subscription_status in (
            SubscriptionStatusEnum.expired,
            SubscriptionStatusEnum.canceled,
        )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email} plan={enum_value(self.plan)}>"


class Content(Base):
    __tablename__ = "contents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    platform = Column(String(50), nullable=False)
    content_type = Column(SAEnum(ContentTypeEnum), nullable=False, default=ContentTypeEnum.post)
    text_content = Column(Text, nullable=True)
    media_urls = Column(JSON, nullable=False, default=list)
    hashtags = Column(JSON, nullable=False, default=list)

    status = Column(SAEnum(ContentStatusEnum), nullable=False, default=ContentStatusEnum.draft)
    scheduled_at = Column(DateTime, nullable=True)
    published_at = Column(DateTime, nullable=True)

    engagement_metrics = Column(JSON, nullable=False, default=dict)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="contents")

    def __repr__(self) -> str:
        return f"<Content id={self.id} user_id={self.user_id} platform={self.platform} status={enum_value(self.status)}>"


class Analytics(Base):
    __tablename__ = "analytics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    date = Column(Date, nullable=False, default=lambda: datetime.utcnow().date())
    platform = Column(String(50), nullable=False)

    impressions = Column(Integer, default=0)
    reach = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    saves = Column(Integer, default=0)

    follower_growth = Column(Integer, default=0)
    engagement_rate = Column(Float, default=0.0)

    user = relationship("User", back_populates="analytics")

    def __repr__(self) -> str:
        return f"<Analytics id={self.id} user_id={self.user_id} date={self.date} platform={self.platform}>"


class EngagementReply(Base):
    """Vom Engagement-Agent generierte Antwort auf einen Kommentar oder eine
    DM (siehe agents/engagement.py) - persistiert, damit sie im Dashboard
    anzeigbar ist statt nur im Server-Log zu verschwinden."""

    __tablename__ = "engagement_replies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    platform = Column(String(50), nullable=False)
    source_type = Column(String(20), nullable=False)  # "comment" oder "dm"
    source_text = Column(Text, nullable=False)
    reply_text = Column(Text, nullable=False)
    is_lead = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="engagement_replies")

    def __repr__(self) -> str:
        return f"<EngagementReply id={self.id} user_id={self.user_id} source_type={self.source_type}>"


class GrowthStrategy(Base):
    """Vom Growth-Agent erstellte Wachstumsstrategie inkl. Ziel-Follower und
    Konkurrenz-Analyse (siehe agents/growth.py) - persistiert, damit sie im
    Dashboard anzeigbar ist statt nur einmalig zurueckgegeben zu werden."""

    __tablename__ = "growth_strategies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    platform = Column(String(50), nullable=False)
    niche = Column(String(100), nullable=False)
    target_followers = Column(JSON, nullable=False, default=list)
    competitor_analysis = Column(JSON, nullable=False, default=list)
    strategy_text = Column(Text, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="growth_strategies")

    def __repr__(self) -> str:
        return f"<GrowthStrategy id={self.id} user_id={self.user_id} platform={self.platform}>"


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    stripe_invoice_id = Column(String(255), nullable=True, default=gen_uuid)
    amount = Column(Float, nullable=False, default=0.0)
    currency = Column(String(10), nullable=False, default="usd")
    status = Column(SAEnum(PaymentStatusEnum), nullable=False, default=PaymentStatusEnum.pending)
    plan_at_time = Column(String(50), nullable=False)

    billing_period_start = Column(DateTime, nullable=True)
    billing_period_end = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="payments")

    def __repr__(self) -> str:
        return f"<Payment id={self.id} user_id={self.user_id} amount={self.amount} status={enum_value(self.status)}>"


class FeedbackCategoryEnum(str, enum.Enum):
    bug = "bug"
    feature = "feature"
    idea = "idea"


class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    category = Column(SAEnum(FeedbackCategoryEnum), nullable=False, default=FeedbackCategoryEnum.idea)
    message = Column(Text, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="feedback_entries")

    def __repr__(self) -> str:
        return f"<Feedback id={self.id} user_id={self.user_id} category={enum_value(self.category)}>"
