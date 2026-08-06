"""
E-Mail-Versand ueber die Resend-HTTP-API (https://resend.com).

Laeuft im MOCK-Modus (config.MOCK_EMAIL), wenn kein echter RESEND_API_KEY
gesetzt ist: E-Mails werden nicht versendet, sondern nur geloggt (Konsole +
logs/app.log). So laesst sich der komplette Flow ohne Resend-Account testen.

Bewusst per HTTPS statt SMTP: viele PaaS-Hoster (u.a. Railway) blockieren
ausgehende SMTP-Ports als Anti-Spam-Massnahme (siehe git-history - direkter
SMTP-Versand ueber Gmail scheiterte deshalb dort mit einem Connection-Fehler).

TODO: Fuer Produktion echte HTML-Templates statt Plaintext verwenden.
"""
import logging

import requests

from config import BACKEND_BASE_URL, MOCK_EMAIL, RESEND_API_KEY, RESEND_FROM_EMAIL

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


def _send(to_email: str, subject: str, body: str) -> dict:
    if MOCK_EMAIL:
        logger.info("[MOCK-EMAIL] An: %s | Betreff: %s\n%s", to_email, subject, body)
        return {"status": "mocked", "to": to_email, "subject": subject}

    response = requests.post(
        RESEND_API_URL,
        headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
        json={"from": RESEND_FROM_EMAIL, "to": [to_email], "subject": subject, "text": body},
        timeout=10,
    )
    response.raise_for_status()

    logger.info("E-Mail an %s gesendet (id=%s)", to_email, response.json().get("id"))
    return {"status": "sent", "to": to_email, "subject": subject}


def send_welcome_email(to_email: str, plan: str) -> dict:
    subject = "Willkommen bei deinem KI-Social-Media-Automation-System!"
    body = (
        f"Hallo,\n\nwillkommen an Bord! Dein Account ist jetzt aktiv mit dem "
        f"Plan '{plan}'.\n\nDeine KI-Agenten stehen bereit, um Content fuer "
        f"dich zu erstellen und zu veroeffentlichen.\n\nViel Erfolg!"
    )
    return _send(to_email, subject, body)


def send_beta_onboarding_email(to_email: str, temp_password: str) -> dict:
    subject = "Willkommen in der Beta! Deine Zugangsdaten + erste Schritte"
    dashboard_url = f"{BACKEND_BASE_URL}/dashboard" if BACKEND_BASE_URL else "das Dashboard (Link von uns erfragen)"
    body = (
        f"Hallo,\n\nschoen, dass du dabei bist! Dein Beta-Tester-Account ist "
        f"aktiv - mit vollem Zugriff auf alle 5 KI-Agenten, unbegrenzte Posts "
        f"und Videos, komplett kostenlos waehrend der Beta.\n\n"
        f"Dashboard: {dashboard_url}\n"
        f"Login: {to_email}\n"
        f"Temporaeres Passwort: {temp_password}\n"
        f"(Bitte nach dem ersten Login aendern - Passwort-Aenderung ist ein "
        f"TODO fuer die naechste Ausbaustufe des Dashboards.)\n\n"
        f"So startest du:\n"
        f"1. Oben stehenden Dashboard-Link oeffnen und einloggen\n"
        f"2. Wir haben bereits einen ersten Beispiel-Post fuer dich erstellt -\n"
        f"   schau im Bereich 'Letzter Content' vorbei. Ueber den Button\n"
        f"   'Neue Beispiel-Aktivitaet generieren' kannst du jederzeit einen\n"
        f"   weiteren Durchlauf (Post, Kommentare, Analytics) anstossen\n"
        f"3. Nutze 'Feedback geben' im Dashboard, um uns Bugs, Ideen oder\n"
        f"   Feature-Wuensche zu schicken - das hilft uns extrem!\n\n"
        f"Viel Spass beim Testen!"
    )
    return _send(to_email, subject, body)


def send_payment_reminder(to_email: str, days_left: int) -> dict:
    subject = "Zahlungserinnerung: Bitte aktualisiere deine Zahlungsmethode"
    body = (
        f"Hallo,\n\nleider ist deine letzte Zahlung fehlgeschlagen. Du hast "
        f"noch {days_left} Tage Grace-Period, bevor dein Zugriff auf "
        f"Automatisierungs-Funktionen eingeschraenkt wird (nur Lesezugriff).\n\n"
        f"Bitte aktualisiere deine Zahlungsmethode im Dashboard."
    )
    return _send(to_email, subject, body)


def send_monthly_report(to_email: str, report_summary: str) -> dict:
    subject = "Dein monatlicher Social-Media-Report"
    body = f"Hallo,\n\nhier ist dein monatlicher Performance-Report:\n\n{report_summary}"
    return _send(to_email, subject, body)


def send_upgrade_confirmation(to_email: str, old_plan: str, new_plan: str) -> dict:
    subject = "Dein Plan wurde aktualisiert"
    body = (
        f"Hallo,\n\ndein Plan wurde erfolgreich von '{old_plan}' auf "
        f"'{new_plan}' umgestellt. Die neuen Limits und Agenten sind sofort "
        f"aktiv."
    )
    return _send(to_email, subject, body)


def send_cancellation_confirmation(to_email: str) -> dict:
    subject = "Dein Abo wurde gekuendigt"
    body = (
        "Hallo,\n\ndein Abo wurde gekuendigt. Du hast weiterhin Lesezugriff "
        "auf deine bisherigen Inhalte, es werden aber keine neuen Posts mehr "
        "erstellt oder veroeffentlicht.\n\nSchade, dich gehen zu sehen!"
    )
    return _send(to_email, subject, body)
