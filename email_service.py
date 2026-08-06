"""
E-Mail-Versand ueber SMTP (z.B. Gmail mit App-Passwort).

Laeuft im MOCK-Modus (config.MOCK_EMAIL), wenn kein echter SMTP_USERNAME/
SMTP_PASSWORD gesetzt ist: E-Mails werden nicht versendet, sondern nur
geloggt (Konsole + logs/app.log). So laesst sich der komplette Flow ohne
E-Mail-Account testen.

TODO: Fuer Produktion echte HTML-Templates statt Plaintext verwenden.
"""
import logging
import smtplib
from email.mime.text import MIMEText

from config import BACKEND_BASE_URL, MOCK_EMAIL, SMTP_FROM_EMAIL, SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_USERNAME

logger = logging.getLogger(__name__)


def _send(to_email: str, subject: str, body: str) -> dict:
    if MOCK_EMAIL:
        logger.info("[MOCK-EMAIL] An: %s | Betreff: %s\n%s", to_email, subject, body)
        return {"status": "mocked", "to": to_email, "subject": subject}

    message = MIMEText(body, "plain", "utf-8")
    message["Subject"] = subject
    message["From"] = SMTP_FROM_EMAIL
    message["To"] = to_email

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.sendmail(SMTP_FROM_EMAIL, [to_email], message.as_string())

    logger.info("E-Mail an %s gesendet", to_email)
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
