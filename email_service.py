"""
E-Mail-Versand ueber SendGrid.

Laeuft im MOCK-Modus (config.MOCK_SENDGRID), wenn kein echter SENDGRID_API_KEY
gesetzt ist: E-Mails werden nicht versendet, sondern nur geloggt (Konsole +
logs/app.log). So laesst sich der komplette Flow ohne SendGrid-Account testen.

TODO: Fuer Produktion echte HTML-Templates (z.B. via SendGrid Dynamic
Templates) statt Plaintext verwenden.
"""
import logging

from config import MOCK_SENDGRID, SENDGRID_API_KEY, SENDGRID_FROM_EMAIL

logger = logging.getLogger(__name__)

if not MOCK_SENDGRID:
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail
else:
    SendGridAPIClient = None  # type: ignore
    Mail = None  # type: ignore


def _send(to_email: str, subject: str, body: str) -> dict:
    if MOCK_SENDGRID:
        logger.info("[MOCK-EMAIL] An: %s | Betreff: %s\n%s", to_email, subject, body)
        return {"status": "mocked", "to": to_email, "subject": subject}

    message = Mail(
        from_email=SENDGRID_FROM_EMAIL,
        to_emails=to_email,
        subject=subject,
        plain_text_content=body,
    )
    client = SendGridAPIClient(SENDGRID_API_KEY)
    response = client.send(message)
    logger.info("E-Mail an %s gesendet (status=%s)", to_email, response.status_code)
    return {"status": "sent", "to": to_email, "subject": subject, "status_code": response.status_code}


def send_welcome_email(to_email: str, plan: str) -> dict:
    subject = "Willkommen bei deinem KI-Social-Media-Automation-System!"
    body = (
        f"Hallo,\n\nwillkommen an Bord! Dein Account ist jetzt aktiv mit dem "
        f"Plan '{plan}'.\n\nDeine KI-Agenten stehen bereit, um Content fuer "
        f"dich zu erstellen und zu veroeffentlichen.\n\nViel Erfolg!"
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
