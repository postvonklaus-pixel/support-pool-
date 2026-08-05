"""
Production-Start-Befehl: "python production.py"

Startet die konsolidierte app.py (Landing Page + Beta-Signup + Stripe-Webhook
+ HTML-Dashboard) auf einem einzelnen Port und fuehrt den taeglichen Workflow
im Hintergrund aus - passend fuer Hosts, die nur einen Prozess/Port erlauben
(Render, Railway, Heroku-artige Free-Tiers). Siehe DEPLOY.md.

Fuer lokale Entwicklung mit vollem Funktionsumfang (separate
Streamlit-Dashboards mit Charts) stattdessen main.py + dashboard.py +
admin_dashboard.py nutzen.

Laeuft komplett im MOCK-Modus ohne echte API-Keys, SQLite als Datenbank
(kein externer Service noetig).
"""
import logging
import threading
import time

import schedule

from agents import build_agents
from app import app
from config import WEBHOOK_HOST, WEBHOOK_PORT
from db import init_db
from logging_config import setup_logging
from seed import has_users, seed_users
from workflow import daily_workflow

setup_logging()
logger = logging.getLogger("production")


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


def start_background_scheduler(agents: dict) -> threading.Thread:
    thread = threading.Thread(
        target=run_scheduler_loop, args=(agents,), name="daily-workflow-scheduler", daemon=True
    )
    thread.start()
    return thread


def main() -> None:
    logger.info("=== Production-Start: KI-Social-Media-Automation-System ===")
    bootstrap()

    logger.info("Initialisiere 5 KI-Agenten (Content Creator, Publisher, Engagement, Analytics, Growth)...")
    agents = build_agents()
    for agent_id, agent in agents.items():
        logger.info("  -> Agent bereit: %s (%s)", agent_id, agent.__class__.__name__)

    logger.info("Fuehre taeglichen Workflow initial aus (nur aktive Abos)...")
    daily_workflow(agents=agents)

    start_background_scheduler(agents)

    logger.info(
        "Server startet: Landing Page http://%s:%s/  |  Dashboard http://%s:%s/dashboard  |  "
        "Webhook http://%s:%s/webhook",
        WEBHOOK_HOST, WEBHOOK_PORT, WEBHOOK_HOST, WEBHOOK_PORT, WEBHOOK_HOST, WEBHOOK_PORT,
    )
    # TODO: fuer echten Produktionsbetrieb (>~ein paar gleichzeitige Nutzer)
    # statt des eingebauten Flask-Dev-Servers einen WSGI-Server verwenden,
    # z.B. "gunicorn app:app --bind 0.0.0.0:$PORT" (siehe DEPLOY.md).
    app.run(host=WEBHOOK_HOST, port=WEBHOOK_PORT, use_reloader=False, threaded=True)


if __name__ == "__main__":
    main()
