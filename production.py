"""
Lokaler Fallback-Start ohne Gunicorn: "python production.py"

Fuer den echten Produktivbetrieb (Railway) startet railway.json direkt
"gunicorn app:app" (siehe RAILWAY_DEPLOY.md) - Bootstrap (DB-Init, Seed) und
der taegliche Scheduler laufen dafuer auf Modul-Ebene in app.py, nicht mehr
hier, damit sie unter Gunicorn genauso greifen wie hier lokal.

Fuer lokale Entwicklung mit vollem Funktionsumfang (separate
Streamlit-Dashboards mit Charts) stattdessen main.py + dashboard.py +
admin_dashboard.py nutzen.
"""
import logging

from app import app
from config import WEBHOOK_HOST, WEBHOOK_PORT
from logging_config import setup_logging

setup_logging()
logger = logging.getLogger("production")


def main() -> None:
    logger.info("=== Lokaler Start (Fallback, kein Gunicorn): KI-Social-Media-Automation-System ===")
    logger.info(
        "Server startet: Landing Page http://%s:%s/  |  Dashboard http://%s:%s/dashboard  |  "
        "Admin http://%s:%s/admin  |  Webhook http://%s:%s/webhook",
        WEBHOOK_HOST, WEBHOOK_PORT, WEBHOOK_HOST, WEBHOOK_PORT,
        WEBHOOK_HOST, WEBHOOK_PORT, WEBHOOK_HOST, WEBHOOK_PORT,
    )
    app.run(host=WEBHOOK_HOST, port=WEBHOOK_PORT, use_reloader=False, threaded=True)


if __name__ == "__main__":
    main()
