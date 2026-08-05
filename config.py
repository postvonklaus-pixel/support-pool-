"""
Zentrale Konfiguration fuer das KI-Social-Media-Automation-System.

Laedt alle Umgebungsvariablen aus .env und definiert die Pricing-Tiers
(Starter / Creator / Pro / Agent) inklusive aller Limits und Feature-Flags.

Laeuft ohne echte API-Keys: fehlende/Platzhalter-Keys schalten den
jeweiligen Service automatisch in den MOCK-Modus (siehe is_mock_*).
"""
import os
from enum import Enum

from dotenv import load_dotenv

load_dotenv()

# --------------------------------------------------------------------------
# Allgemeine App-Konfiguration
# --------------------------------------------------------------------------
APP_ENV = os.getenv("APP_ENV", "development")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
LOG_DIR = os.getenv("LOG_DIR", "logs")
LOG_FILE = os.path.join(LOG_DIR, "app.log")

# Fallback auf SQLite, damit "python main.py" ohne jedes Setup laeuft.
# In Produktion via .env DATABASE_URL=postgresql://... setzen.
DATABASE_URL = os.getenv("DATABASE_URL") or "sqlite:///./data/app.db"
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

WEBHOOK_HOST = os.getenv("WEBHOOK_HOST", "0.0.0.0")
WEBHOOK_PORT = int(os.getenv("WEBHOOK_PORT", "4242"))

# --------------------------------------------------------------------------
# API-Keys / externe Services
# --------------------------------------------------------------------------
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
REPLICATE_API_TOKEN = os.getenv("REPLICATE_API_TOKEN", "")
BUFFER_ACCESS_TOKEN = os.getenv("BUFFER_ACCESS_TOKEN", "")
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "")
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
SENDGRID_FROM_EMAIL = os.getenv("SENDGRID_FROM_EMAIL", "reports@example.com")

_PLACEHOLDER_MARKERS = ("dein_", "your_", "changeme", "xxxx", "")


def _is_configured(value: str) -> bool:
    """Ein Key gilt als 'echt', wenn er gesetzt ist und keinem Platzhalter entspricht."""
    if not value:
        return False
    lowered = value.strip().lower()
    return not any(marker in lowered for marker in _PLACEHOLDER_MARKERS if marker)


# MOCK-Flags: True => es wird KEIN echter API-Call gemacht, sondern simuliert.
MOCK_OPENAI = not _is_configured(OPENAI_API_KEY)
MOCK_REPLICATE = not _is_configured(REPLICATE_API_TOKEN)
MOCK_BUFFER = not _is_configured(BUFFER_ACCESS_TOKEN)
MOCK_STRIPE = not _is_configured(STRIPE_SECRET_KEY)
MOCK_PINECONE = not _is_configured(PINECONE_API_KEY)
MOCK_SENDGRID = not _is_configured(SENDGRID_API_KEY)

# --------------------------------------------------------------------------
# Pricing-Tiers
# --------------------------------------------------------------------------


class PlanTier(str, Enum):
    STARTER = "starter"
    CREATOR = "creator"
    PRO = "pro"
    AGENT = "agent"


class SubscriptionStatus(str, Enum):
    ACTIVE = "active"
    TRIALING = "trialing"
    PAST_DUE = "past_due"      # Zahlung fehlgeschlagen, Grace-Period laeuft
    CANCELED = "canceled"
    EXPIRED = "expired"        # Grace-Period abgelaufen -> nur Lesezugriff


# Agent-IDs, wie sie in User.agent_access gespeichert werden.
AGENT_CONTENT_CREATOR = "content_creator"
AGENT_PUBLISHER = "publisher"
AGENT_ENGAGEMENT = "engagement"
AGENT_ANALYTICS = "analytics"
AGENT_GROWTH = "growth"

ALL_AGENT_IDS = [
    AGENT_CONTENT_CREATOR,
    AGENT_PUBLISHER,
    AGENT_ENGAGEMENT,
    AGENT_ANALYTICS,
    AGENT_GROWTH,
]

# -1 bedeutet "unbegrenzt"
UNLIMITED = -1

PLAN_CONFIG = {
    PlanTier.STARTER: {
        "name": "Starter",
        "price_usd": 29,
        "platform_limit": 1,
        "post_limit": 10,
        "video_limit": 0,
        "agents": [AGENT_CONTENT_CREATOR],
        "engagement_level": "none",         # kein Engagement
        "analytics_level": "basic",         # Basis-Report, woechentlich
        "analytics_frequency": "weekly",
        "content_calendar": False,
        "lead_identification": False,
        "white_label": False,
        "priority_support": False,
    },
    PlanTier.CREATOR: {
        "name": "Creator",
        "price_usd": 99,
        "platform_limit": 3,
        "post_limit": 30,
        "video_limit": 5,
        "agents": [AGENT_CONTENT_CREATOR, AGENT_PUBLISHER],
        "engagement_level": "basic",        # nur Kommentare lesen
        "analytics_level": "standard",      # Standard-Report, taeglich
        "analytics_frequency": "daily",
        "content_calendar": False,
        "lead_identification": False,
        "white_label": False,
        "priority_support": False,
    },
    PlanTier.PRO: {
        "name": "Pro",
        "price_usd": 299,
        "platform_limit": 6,
        "post_limit": UNLIMITED,
        "video_limit": 30,
        "agents": [AGENT_CONTENT_CREATOR, AGENT_PUBLISHER, AGENT_ENGAGEMENT, AGENT_ANALYTICS],
        "engagement_level": "full",         # Kommentare + DMs
        "analytics_level": "advanced",      # Erweiterter Report, Echtzeit
        "analytics_frequency": "realtime",
        "content_calendar": True,
        "lead_identification": False,
        "white_label": False,
        "priority_support": False,
    },
    PlanTier.AGENT: {
        "name": "Agent",
        "price_usd": 999,
        "platform_limit": 6,
        "post_limit": UNLIMITED,
        "video_limit": UNLIMITED,
        "agents": [
            AGENT_CONTENT_CREATOR,
            AGENT_PUBLISHER,
            AGENT_ENGAGEMENT,
            AGENT_ANALYTICS,
            AGENT_GROWTH,
        ],
        "engagement_level": "full_leads",   # Voll-Engagement + Lead-Identifikation
        "analytics_level": "full",          # Voll-Report + Empfehlungen
        "analytics_frequency": "realtime",
        "content_calendar": True,
        "lead_identification": True,
        "white_label": True,
        "priority_support": True,
    },
}

# 7-Tage-Grace-Period bei Zahlungsfehlschlag (PAST_DUE -> EXPIRED danach).
GRACE_PERIOD_DAYS = int(os.getenv("GRACE_PERIOD_DAYS", "7"))

# --------------------------------------------------------------------------
# MRR-Tracking
# --------------------------------------------------------------------------
# Monatliches MRR-Ziel, linear auf die Tage des Monats umgelegt fuer den
# taeglichen Report/Alarm ("Alarm wenn MRR < Ziel fuer aktuellen Tag").
MRR_TARGET_MONTHLY = float(os.getenv("MRR_TARGET_MONTHLY", "10000"))
