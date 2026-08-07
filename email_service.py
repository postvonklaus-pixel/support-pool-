"""
E-Mail-Versand ueber die Resend-HTTP-API (https://resend.com).

Laeuft im MOCK-Modus (config.MOCK_EMAIL), wenn kein echter RESEND_API_KEY
gesetzt ist: E-Mails werden nicht versendet, sondern nur geloggt (Konsole +
logs/app.log). So laesst sich der komplette Flow ohne Resend-Account testen.

Bewusst per HTTPS statt SMTP: viele PaaS-Hoster (u.a. Railway) blockieren
ausgehende SMTP-Ports als Anti-Spam-Massnahme (siehe git-history - direkter
SMTP-Versand ueber Gmail scheiterte deshalb dort mit einem Connection-Fehler).

Jede Mail wird als HTML (gebrandet, siehe _render_html) UND als Plaintext
verschickt (Resend baut daraus automatisch eine multipart-Mail) - E-Mail-
Clients, die kein HTML anzeigen, bekommen weiterhin eine lesbare Mail.
"""
import logging

import requests

from config import BACKEND_BASE_URL, MOCK_EMAIL, RESEND_API_KEY, RESEND_FROM_EMAIL

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


def _render_html(heading: str, paragraphs: list[str], cta: dict | None = None) -> str:
    """Baut eine einfache, gebrandete HTML-Mail (Inline-CSS, da E-Mail-Clients
    kein externes CSS/Tailwind laden - passend zum Slate/Indigo-Look der App)."""
    paragraphs_html = "".join(
        f'<p style="margin:0 0 12px 0;color:#cbd5e1;font-size:14px;line-height:1.6;">{p}</p>'
        for p in paragraphs
    )
    cta_html = ""
    if cta:
        cta_html = (
            f'<a href="{cta["url"]}" style="display:inline-block;margin-top:8px;'
            f'padding:10px 20px;background:#4f46e5;color:#ffffff;border-radius:8px;'
            f'text-decoration:none;font-weight:600;font-size:14px;">{cta["text"]}</a>'
        )
    return f"""\
<!doctype html>
<html>
<body style="margin:0;padding:0;background:#020617;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#020617;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:480px;background:#0f172a;border:1px solid #1e293b;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:24px 24px 0 24px;">
          <span style="font-size:20px;font-weight:700;color:#f1f5f9;">🤖 AutoSocial <span style="color:#a855f7;">AI</span></span>
        </td></tr>
        <tr><td style="padding:20px 24px 8px 24px;">
          <h1 style="margin:0 0 16px 0;font-size:19px;color:#f1f5f9;">{heading}</h1>
          {paragraphs_html}
          {cta_html}
        </td></tr>
        <tr><td style="padding:24px;border-top:1px solid #1e293b;margin-top:8px;">
          <a href="https://autosocial.cc" style="color:#818cf8;font-size:12px;text-decoration:none;">autosocial.cc</a>
          <span style="color:#475569;font-size:12px;"> &middot; AutoSocial AI Beta</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""


def _send(to_email: str, subject: str, text: str, html: str) -> dict:
    if MOCK_EMAIL:
        logger.info("[MOCK-EMAIL] An: %s | Betreff: %s\n%s", to_email, subject, text)
        return {"status": "mocked", "to": to_email, "subject": subject}

    response = requests.post(
        RESEND_API_URL,
        headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
        json={"from": RESEND_FROM_EMAIL, "to": [to_email], "subject": subject, "text": text, "html": html},
        timeout=10,
    )
    response.raise_for_status()

    logger.info("E-Mail an %s gesendet (id=%s)", to_email, response.json().get("id"))
    return {"status": "sent", "to": to_email, "subject": subject}


def send_welcome_email(to_email: str, plan: str) -> dict:
    subject = "Willkommen bei deinem KI-Social-Media-Automation-System!"
    text = (
        f"Hallo,\n\nwillkommen an Bord! Dein Account ist jetzt aktiv mit dem "
        f"Plan '{plan}'.\n\nDeine KI-Agenten stehen bereit, um Content fuer "
        f"dich zu erstellen und zu veroeffentlichen.\n\nViel Erfolg!"
    )
    cta = {"text": "Zum Dashboard", "url": f"{BACKEND_BASE_URL}/dashboard"} if BACKEND_BASE_URL else None
    html = _render_html(
        "Willkommen an Bord! 🎉",
        [
            f"Dein Account ist jetzt aktiv mit dem Plan <strong>{plan}</strong>.",
            "Deine KI-Agenten stehen bereit, um Content fuer dich zu erstellen und zu veroeffentlichen.",
            "Viel Erfolg!",
        ],
        cta=cta,
    )
    return _send(to_email, subject, text, html)


def send_beta_onboarding_email(to_email: str, temp_password: str) -> dict:
    subject = "Willkommen in der Beta! Deine Zugangsdaten + erste Schritte"
    dashboard_url = f"{BACKEND_BASE_URL}/dashboard" if BACKEND_BASE_URL else "das Dashboard (Link von uns erfragen)"
    text = (
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
    cta = {"text": "Jetzt einloggen", "url": f"{BACKEND_BASE_URL}/dashboard"} if BACKEND_BASE_URL else None
    html = _render_html(
        "Schoen, dass du dabei bist! 🚀",
        [
            "Dein Beta-Tester-Account ist aktiv &mdash; mit vollem Zugriff auf alle 5 KI-Agenten, "
            "unbegrenzte Posts und Videos, komplett kostenlos waehrend der Beta.",
            f"<strong>Login:</strong> {to_email}<br><strong>Temporaeres Passwort:</strong> {temp_password}",
            "Wir haben schon einen ersten Beispiel-Post fuer dich erstellt &mdash; schau im Dashboard unter "
            "„Letzter Content“ vorbei. Ueber den Button „Neue Beispiel-Aktivitaet generieren“ "
            "kannst du jederzeit einen weiteren Durchlauf anstossen.",
            "Nutze „Feedback geben“ im Dashboard, um uns Bugs, Ideen oder Feature-Wuensche zu schicken "
            "&mdash; das hilft uns extrem!",
        ],
        cta=cta,
    )
    return _send(to_email, subject, text, html)


def send_payment_reminder(to_email: str, days_left: int) -> dict:
    subject = "Zahlungserinnerung: Bitte aktualisiere deine Zahlungsmethode"
    text = (
        f"Hallo,\n\nleider ist deine letzte Zahlung fehlgeschlagen. Du hast "
        f"noch {days_left} Tage Grace-Period, bevor dein Zugriff auf "
        f"Automatisierungs-Funktionen eingeschraenkt wird (nur Lesezugriff).\n\n"
        f"Bitte aktualisiere deine Zahlungsmethode im Dashboard."
    )
    cta = {"text": "Zahlungsmethode aktualisieren", "url": f"{BACKEND_BASE_URL}/dashboard"} if BACKEND_BASE_URL else None
    html = _render_html(
        "Zahlung fehlgeschlagen ⚠️",
        [
            f"Leider ist deine letzte Zahlung fehlgeschlagen. Du hast noch <strong>{days_left} Tage</strong> "
            "Grace-Period, bevor dein Zugriff auf Automatisierungs-Funktionen eingeschraenkt wird "
            "(nur Lesezugriff).",
            "Bitte aktualisiere deine Zahlungsmethode im Dashboard.",
        ],
        cta=cta,
    )
    return _send(to_email, subject, text, html)


def send_monthly_report(to_email: str, report_summary: str) -> dict:
    subject = "Dein monatlicher Social-Media-Report"
    text = f"Hallo,\n\nhier ist dein monatlicher Performance-Report:\n\n{report_summary}"
    html = _render_html("Dein monatlicher Report 📊", [report_summary])
    return _send(to_email, subject, text, html)


def send_upgrade_confirmation(to_email: str, old_plan: str, new_plan: str) -> dict:
    subject = "Dein Plan wurde aktualisiert"
    text = (
        f"Hallo,\n\ndein Plan wurde erfolgreich von '{old_plan}' auf "
        f"'{new_plan}' umgestellt. Die neuen Limits und Agenten sind sofort "
        f"aktiv."
    )
    cta = {"text": "Zum Dashboard", "url": f"{BACKEND_BASE_URL}/dashboard"} if BACKEND_BASE_URL else None
    html = _render_html(
        "Dein Plan wurde aktualisiert ✅",
        [
            f"Dein Plan wurde erfolgreich von <strong>{old_plan}</strong> auf "
            f"<strong>{new_plan}</strong> umgestellt. Die neuen Limits und Agenten sind sofort aktiv.",
        ],
        cta=cta,
    )
    return _send(to_email, subject, text, html)


def send_cancellation_confirmation(to_email: str) -> dict:
    subject = "Dein Abo wurde gekuendigt"
    text = (
        "Hallo,\n\ndein Abo wurde gekuendigt. Du hast weiterhin Lesezugriff "
        "auf deine bisherigen Inhalte, es werden aber keine neuen Posts mehr "
        "erstellt oder veroeffentlicht.\n\nSchade, dich gehen zu sehen!"
    )
    html = _render_html(
        "Dein Abo wurde gekuendigt",
        [
            "Du hast weiterhin Lesezugriff auf deine bisherigen Inhalte, es werden aber keine neuen "
            "Posts mehr erstellt oder veroeffentlicht.",
            "Schade, dich gehen zu sehen!",
        ],
    )
    return _send(to_email, subject, text, html)
