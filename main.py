"""
Hauptskript des KI-Social-Media-Automation-Systems.

Startet mit "python main.py":
  1. Laedt alle Umgebungsvariablen (ueber config.py / .env)
  2. Initialisiert die Datenbank (und seedet 5 Test-User, falls leer)
  3. Startet den Stripe-Webhook-Server (Flask) in einem Hintergrund-Thread
  4. Initialisiert die 5 KI-Agenten (mit Plan-Berechtigungen)
  5. Fuehrt den taeglichen Workflow einmal sofort aus und schedult ihn
     danach taeglich (nur fuer aktive Abos)
  6. Loggt alles nach logs/app.log

Laeuft komplett im MOCK-Modus ohne echte API-Keys (siehe .env.example / README).
"""
import logging
import threading
import time

import schedule
from flask import Flask, jsonify, redirect, request

import payment
from beta import BetaSignupError, create_beta_user
from config import LANDING_PAGE_URL, MOCK_STRIPE, WEBHOOK_HOST, WEBHOOK_PORT
from db import init_db
from agents import build_agents
from logging_config import setup_logging
from seed import has_users, seed_users
from workflow import daily_workflow

setup_logging()
logger = logging.getLogger("main")

webhook_app = Flask(__name__)


@webhook_app.get("/")
def landing_page():
    """Leitet zur kanonischen Landing Page auf GitHub Pages weiter (siehe
    config.LANDING_PAGE_URL) - die Quelldatei liegt im Repo unter
    ai-automation/index.html."""
    return redirect(LANDING_PAGE_URL)


@webhook_app.get("/health")
def health():
    return jsonify({"status": "ok", "mock_stripe": MOCK_STRIPE})


@webhook_app.post("/webhook")
def stripe_webhook():
    payload = request.get_data()
    sig_header = request.headers.get("Stripe-Signature")
    try:
        result = payment.handle_webhook(payload, sig_header)
        return jsonify(result), 200
    except payment.PaymentError as exc:
        logger.error("Webhook-Fehler: %s", exc)
        return jsonify({"error": str(exc)}), 400


@webhook_app.post("/beta-signup")
def beta_signup():
    """Von der Landing Page aufgerufen: registriert einen neuen Beta-Tester."""
    data = request.get_json(silent=True) or {}
    email = data.get("email", "")
    try:
        result = create_beta_user(email)
    except BetaSignupError as exc:
        return jsonify({"error": str(exc)}), 400

    # Aus Sicherheitsgruenden nie das temporaere Passwort in der HTTP-Antwort
    # zurueckgeben - es steht in der (Mock-)Onboarding-E-Mail / im Log.
    result.pop("temp_password", None)
    return jsonify(result), 201 if result["status"] == "created" else 200


def start_webhook_server() -> threading.Thread:
    def _run():
        logger.info("Landing Page: http://localhost:%s/  |  Webhook: http://%s:%s/webhook (MOCK_STRIPE=%s)",
                    WEBHOOK_PORT, WEBHOOK_HOST, WEBHOOK_PORT, MOCK_STRIPE)
        webhook_app.run(host=WEBHOOK_HOST, port=WEBHOOK_PORT, use_reloader=False, threaded=True)

    thread = threading.Thread(target=_run, name="webhook-server", daemon=True)
    thread.start()
    return thread


def bootstrap() -> None:
    logger.info("Initialisiere Datenbank...")
    init_db()

    if not has_users():
        logger.info("Keine User gefunden, lege Test-Daten an...")
        seed_users()
    else:
        logger.info("Bestehende User gefunden, ueberspringe Seeding.")


def run_scheduler_loop(agents: dict) -> None:
    schedule.every().day.at("06:00").do(daily_workflow, agents=agents)
    logger.info("Taeglicher Workflow eingeplant fuer 06:00 Uhr (naechster Lauf morgen).")

    while True:
        schedule.run_pending()
        time.sleep(30)


def main() -> None:
    logger.info("=== KI-Social-Media-Automation-System startet ===")
    bootstrap()

    start_webhook_server()

    logger.info("Initialisiere 5 KI-Agenten (Content Creator, Publisher, Engagement, Analytics, Growth)...")
    agents = build_agents()
    for agent_id, agent in agents.items():
        logger.info("  -> Agent bereit: %s (%s)", agent_id, agent.__class__.__name__)

    logger.info("Fuehre taeglichen Workflow initial aus (nur aktive Abos)...")
    daily_workflow(agents=agents)

    try:
        run_scheduler_loop(agents)
    except KeyboardInterrupt:
        logger.info("Beende auf Benutzerwunsch (Ctrl+C).")


if __name__ == "__main__":
    main()
