"""
Beta-Onboarding-Workflow (Phase 2: Beta-Testing vorbereiten).

create_beta_user(email) erledigt den kompletten Ablauf automatisch:
1. Legt den User mit dem kostenlosen Beta-Tester-Plan an (voller
   Feature-Zugriff, $0/Monat, siehe config.PLAN_CONFIG[PlanTier.BETA])
2. Verschickt eine Onboarding-E-Mail mit Login-Daten und Anleitung
3. Erstellt automatisch ein Beispiel-Post ueber den Content-Creator-Agenten,
   damit der neue Beta-Tester sofort etwas im Dashboard sieht

Wird von main.py's "/beta-signup"-Endpoint (Landing Page) und optional
direkt genutzt.
"""
import logging
import secrets

from agents.content_creator import ContentCreatorAgent
from auth import hash_password
from config import PLAN_CONFIG, PlanTier
from db import get_session
from email_service import send_beta_onboarding_email
from models import SubscriptionStatusEnum, User

logger = logging.getLogger(__name__)


class BetaSignupError(Exception):
    pass


def create_beta_user(email: str) -> dict:
    """
    Registriert einen neuen Beta-Tester oder gibt den bestehenden Account
    zurueck, falls die E-Mail bereits registriert ist (idempotent, damit ein
    Doppelklick auf den "Beta Access"-Button nicht fehlschlaegt).
    """
    email = (email or "").strip().lower()
    if not email or "@" not in email or "." not in email.split("@")[-1]:
        raise BetaSignupError("Ungueltige E-Mail-Adresse.")

    cfg = PLAN_CONFIG[PlanTier.BETA]

    with get_session() as session:
        existing = session.query(User).filter_by(email=email).first()
        if existing:
            logger.info("Beta-Signup: %s ist bereits registriert (id=%s).", email, existing.id)
            return {"status": "already_registered", "user_id": existing.id, "email": email}

        temp_password = secrets.token_urlsafe(12)
        user = User(
            email=email,
            password_hash=hash_password(temp_password),
            plan=PlanTier.BETA.value,
            platform_limit=cfg["platform_limit"],
            post_limit=cfg["post_limit"],
            video_limit=cfg["video_limit"],
            agent_access=list(cfg["agents"]),
            subscription_status=SubscriptionStatusEnum.active.value,
        )
        session.add(user)
        session.flush()
        user_id = user.id

        # Beispiel-Content erzeugen, solange die Session noch offen ist
        # (get_session_for in content_creator.py nutzt sie automatisch weiter).
        agent = ContentCreatorAgent(name="content_creator", config={})
        example_content = agent.run(
            user, platform="instagram", topic="Willkommen in der Beta - so startest du durch"
        )

    try:
        send_beta_onboarding_email(email, temp_password)
    except Exception:
        # Der Account ist bereits angelegt (siehe oben) - ein SMTP-Fehler
        # (z.B. falsches App-Passwort) soll den Signup nicht mehr zum
        # Absturz bringen, nur die Mail faellt dann aus (Auto-Login-Link
        # auf der Landing Page bleibt der zuverlaessige Fallback).
        logger.exception("Onboarding-Mail an %s konnte nicht verschickt werden.", email)

    logger.info("Neuer Beta-Tester registriert: id=%s email=%s", user_id, email)

    return {
        "status": "created",
        "user_id": user_id,
        "email": email,
        "temp_password": temp_password,
        "example_content_id": example_content["id"],
    }
