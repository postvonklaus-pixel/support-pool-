"""
Produktions-App: Landing Page + API (Beta-Signup, Stripe-Webhook) + ein
einfaches, server-gerendertes HTML-Dashboard - alles in EINER Datei, damit
sich das Backend leicht auf einem einzelnen Prozess/Port deployen laesst
(Render, Railway, Heroku-artige Hosts, eigener VPS).

Fuer lokale Entwicklung mit vollem Funktionsumfang (Streamlit-Dashboards mit
Charts, Scheduler-Logs im Terminal etc.) weiterhin main.py + dashboard.py +
admin_dashboard.py nutzen - app.py ist bewusst die schlanke
Production-Variante ohne Streamlit-Abhaengigkeit (siehe DEPLOY.md).

Startet NICHT von sich aus einen Server - siehe production.py fuer den
eigentlichen Start-Befehl ("python production.py"). Fuer WSGI-Server:
    gunicorn app:app --bind 0.0.0.0:8080
"""
import logging
from datetime import datetime
from urllib.parse import quote

from flask import Flask, jsonify, redirect, render_template_string, request, session

import payment
from auth import verify_password
from beta import BetaSignupError, create_beta_user
from config import LANDING_PAGE_URL, MOCK_STRIPE, PLAN_CONFIG, PlanTier, SECRET_KEY, SELF_SERVICE_PLANS
from db import get_session, init_db
from models import Content, Feedback, FeedbackCategoryEnum, User, enum_value

logger = logging.getLogger("app")

app = Flask(__name__)
app.secret_key = SECRET_KEY

# Datenbank sofort sicherstellen, egal wie app.py gestartet wird (direkt,
# gunicorn, production.py, Tests) - init_db() ist idempotent.
init_db()


# --------------------------------------------------------------------------
# CORS: die Landing Page laeuft auf GitHub Pages (anderer Origin) und ruft
# /beta-signup per fetch() auf - ohne diese Header wuerde der Browser den
# Cross-Origin-Request blocken. "*" ist hier bewusst offen (oeffentliche
# Mock-Demo, keine sensiblen Daten hinter Cookie-Auth erreichbar, siehe
# /dashboard-Login der ohnehin ueber direkte Navigation laeuft, nicht fetch).
# TODO: fuer echten Betrieb auf die konkrete Pages-Origin einschraenken.
# --------------------------------------------------------------------------
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


# --------------------------------------------------------------------------
# Landing Page, Health, Beta-Signup, Stripe-Webhook
# --------------------------------------------------------------------------
@app.get("/")
def landing_page():
    """Leitet zur kanonischen Landing Page auf GitHub Pages weiter, damit es
    nur eine massgebliche URL gibt (statt Pages + Backend doppelt zu pflegen).
    static/landing.html bleibt Teil des Repos fuer den GitHub-Pages-Build."""
    return redirect(LANDING_PAGE_URL)


@app.get("/health")
def health():
    return jsonify({"status": "ok", "mock_stripe": MOCK_STRIPE})


@app.post("/beta-signup")
def beta_signup():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "")
    try:
        result = create_beta_user(email)
    except BetaSignupError as exc:
        return jsonify({"error": str(exc)}), 400
    # Nie das temporaere Passwort in der HTTP-Antwort zurueckgeben - es steht
    # in der (Mock-)Onboarding-E-Mail / im Server-Log.
    result.pop("temp_password", None)
    return jsonify(result), 201 if result["status"] == "created" else 200


@app.post("/webhook")
def stripe_webhook():
    payload = request.get_data()
    sig_header = request.headers.get("Stripe-Signature")
    try:
        result = payment.handle_webhook(payload, sig_header)
        return jsonify(result), 200
    except payment.PaymentError as exc:
        logger.error("Webhook-Fehler: %s", exc)
        return jsonify({"error": str(exc)}), 400


# --------------------------------------------------------------------------
# Einfaches HTML-Dashboard (server-gerendert, kein Streamlit noetig)
# --------------------------------------------------------------------------
STYLE_HEAD = """
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script src="https://cdn.tailwindcss.com"></script>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}</style>
"""

LOGIN_TEMPLATE = """
<!doctype html><html lang="de"><head>{{ style_head|safe }}<title>Login - Dashboard</title></head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
<div class="max-w-sm mx-auto px-6 pt-24">
  <h1 class="text-2xl font-bold mb-1">📈 Dashboard-Login</h1>
  <p class="text-slate-500 text-sm mb-6">
    Demo: <code>user_pro@test.com</code> / <code>testpassword123</code>
  </p>
  {% if error %}
  <p class="bg-red-950 border border-red-800 text-red-300 rounded-lg px-4 py-2 mb-4 text-sm">{{ error }}</p>
  {% endif %}
  <form method="post" action="/dashboard/login" class="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
    <div>
      <label class="text-sm text-slate-400 block mb-1">E-Mail</label>
      <input name="email" type="email" required class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2">
    </div>
    <div>
      <label class="text-sm text-slate-400 block mb-1">Passwort</label>
      <input name="password" type="password" required class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2">
    </div>
    <button class="w-full bg-indigo-600 hover:bg-indigo-500 transition rounded-lg py-2 font-semibold">Login</button>
  </form>
  <p class="text-xs text-slate-600 mt-6"><a href="/" class="hover:text-slate-400">&larr; Zur Landing Page</a></p>
</div>
</body></html>
"""

DASHBOARD_TEMPLATE = """
<!doctype html><html lang="de"><head>{{ style_head|safe }}<title>Dashboard</title></head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
<nav class="max-w-4xl mx-auto flex items-center justify-between px-6 py-6">
  <a href="/" class="font-bold">🤖 AutoSocial AI</a>
  <div class="flex items-center gap-4 text-sm text-slate-400">
    <span>{{ user.email }} &middot; {{ plan_name }}</span>
    <form method="post" action="/dashboard/logout" class="inline">
      <button class="text-red-400 hover:text-red-300">Logout</button>
    </form>
  </div>
</nav>
<main class="max-w-4xl mx-auto px-6 pb-16 space-y-8">

  {% if flash %}
  <p class="bg-emerald-950 border border-emerald-800 text-emerald-300 rounded-lg px-4 py-2 text-sm">{{ flash }}</p>
  {% endif %}

  <section>
    <h2 class="text-lg font-semibold mb-3">Verbrauch vs. Plan-Limits</h2>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <p class="text-xs text-slate-500">Plattformen</p>
        <p class="text-xl font-bold">{{ usage.platform_count }} / {{ usage.platform_limit_display }}</p>
      </div>
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <p class="text-xs text-slate-500">Posts (Monat)</p>
        <p class="text-xl font-bold">{{ usage.post_count }} / {{ usage.post_limit_display }}</p>
      </div>
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <p class="text-xs text-slate-500">Videos (Monat)</p>
        <p class="text-xl font-bold">{{ usage.video_count }} / {{ usage.video_limit_display }}</p>
      </div>
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <p class="text-xs text-slate-500">Agenten</p>
        <p class="text-xl font-bold">{{ usage.agent_count }} / {{ usage.agent_limit }}</p>
      </div>
    </div>
    {% if usage.is_read_only %}
    <p class="text-amber-400 text-sm mt-3">⚠️ Abo abgelaufen - nur Lesezugriff, keine neuen Posts moeglich.</p>
    {% endif %}
  </section>

  <section>
    <h2 class="text-lg font-semibold mb-3">Plan wechseln (Mock-Upgrade, sofort)</h2>
    <form method="post" action="/dashboard/upgrade" class="flex flex-wrap gap-3 items-center">
      <select name="plan" class="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm">
        {% for p in self_service_plans %}
        <option value="{{ p }}">{{ plan_names[p] }} (${{ plan_prices[p] }}/Monat)</option>
        {% endfor %}
      </select>
      <button class="bg-indigo-600 hover:bg-indigo-500 transition rounded-lg px-4 py-2 text-sm font-semibold">Wechseln</button>
    </form>
  </section>

  <section>
    <h2 class="text-lg font-semibold mb-3">Letzter Content</h2>
    {% if contents %}
    <div class="overflow-x-auto bg-slate-900 border border-slate-800 rounded-xl">
      <table class="w-full text-sm">
        <thead class="text-slate-500 text-left"><tr>
          <th class="px-4 py-2">Plattform</th><th class="px-4 py-2">Typ</th>
          <th class="px-4 py-2">Status</th><th class="px-4 py-2">Text</th>
        </tr></thead>
        <tbody>
          {% for c in contents %}
          <tr class="border-t border-slate-800">
            <td class="px-4 py-2">{{ c.platform }}</td>
            <td class="px-4 py-2">{{ c.content_type }}</td>
            <td class="px-4 py-2">{{ c.status }}</td>
            <td class="px-4 py-2 text-slate-400">{{ c.text }}</td>
          </tr>
          {% endfor %}
        </tbody>
      </table>
    </div>
    {% else %}
    <p class="text-slate-500 text-sm">Noch kein Content vorhanden.</p>
    {% endif %}
  </section>

  <section>
    <h2 class="text-lg font-semibold mb-3">Feedback geben</h2>
    <form method="post" action="/dashboard/feedback" class="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
      <select name="category" class="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm">
        <option value="bug">🐞 Bug</option>
        <option value="feature">✨ Feature-Wunsch</option>
        <option value="idea">💡 Idee</option>
      </select>
      <textarea name="message" required placeholder="Was ist dir aufgefallen?"
        class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" rows="3"></textarea>
      <button class="bg-indigo-600 hover:bg-indigo-500 transition rounded-lg px-4 py-2 text-sm font-semibold">Senden</button>
    </form>

    {% if feedback_entries %}
    <div class="mt-4 space-y-2">
      {% for f in feedback_entries %}
      <div class="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm">
        <span class="text-slate-500">{{ f.created_at }} &middot; {{ f.category }}</span><br>{{ f.message }}
      </div>
      {% endfor %}
    </div>
    {% endif %}
  </section>

</main>
</body></html>
"""


def _fmt_limit(limit: int) -> str:
    return "unbegrenzt" if limit == -1 else str(limit)


@app.get("/dashboard")
def dashboard_view():
    if "user_id" not in session:
        return render_template_string(LOGIN_TEMPLATE, style_head=STYLE_HEAD, error=None)

    user_id = session["user_id"]
    with get_session() as db_session:
        user = db_session.get(User, user_id)
        if not user:
            session.clear()
            return redirect("/dashboard")

        usage = payment.check_plan_limits(user_id)
        usage["platform_limit_display"] = _fmt_limit(usage["platform_limit"])
        usage["post_limit_display"] = _fmt_limit(usage["post_limit"])
        usage["video_limit_display"] = _fmt_limit(usage["video_limit"])

        contents = (
            db_session.query(Content)
            .filter_by(user_id=user_id)
            .order_by(Content.created_at.desc())
            .limit(10)
            .all()
        )
        content_rows = [
            {
                "platform": c.platform,
                "content_type": enum_value(c.content_type),
                "status": enum_value(c.status),
                "text": (c.text_content or "")[:70],
            }
            for c in contents
        ]

        feedback_entries = (
            db_session.query(Feedback)
            .filter_by(user_id=user_id)
            .order_by(Feedback.created_at.desc())
            .limit(10)
            .all()
        )
        feedback_rows = [
            {
                "created_at": f.created_at.strftime("%Y-%m-%d %H:%M"),
                "category": enum_value(f.category),
                "message": f.message,
            }
            for f in feedback_entries
        ]

        plan_name = PLAN_CONFIG[PlanTier(user.plan)]["name"]
        user_email = user.email

    return render_template_string(
        DASHBOARD_TEMPLATE,
        style_head=STYLE_HEAD,
        user={"email": user_email},
        plan_name=plan_name,
        usage=usage,
        contents=content_rows,
        feedback_entries=feedback_rows,
        self_service_plans=[p.value for p in SELF_SERVICE_PLANS],
        plan_names={p.value: PLAN_CONFIG[p]["name"] for p in PlanTier},
        plan_prices={p.value: PLAN_CONFIG[p]["price_usd"] for p in PlanTier},
        flash=request.args.get("flash"),
    )


@app.post("/dashboard/login")
def dashboard_login():
    email = request.form.get("email", "").strip().lower()
    password = request.form.get("password", "")

    with get_session() as db_session:
        user = db_session.query(User).filter_by(email=email).first()
        if not user or not verify_password(password, user.password_hash):
            return render_template_string(LOGIN_TEMPLATE, style_head=STYLE_HEAD, error="E-Mail oder Passwort falsch.")
        user.last_login_at = datetime.utcnow()
        session["user_id"] = user.id

    return redirect("/dashboard")


@app.post("/dashboard/logout")
def dashboard_logout():
    session.clear()
    return redirect("/dashboard")


@app.post("/dashboard/upgrade")
def dashboard_upgrade():
    if "user_id" not in session:
        return redirect("/dashboard")
    new_plan = request.form.get("plan")
    if new_plan in [p.value for p in SELF_SERVICE_PLANS]:
        result = payment.upgrade_plan(session["user_id"], new_plan)
        flash = quote(f"Plan gewechselt: {result['old_plan']} -> {result['new_plan']}")
        return redirect(f"/dashboard?flash={flash}")
    return redirect("/dashboard")


@app.post("/dashboard/feedback")
def dashboard_feedback():
    if "user_id" not in session:
        return redirect("/dashboard")
    category = request.form.get("category", FeedbackCategoryEnum.idea.value)
    message = request.form.get("message", "").strip()
    if message:
        with get_session() as db_session:
            db_session.add(Feedback(user_id=session["user_id"], category=category, message=message))
        return redirect(f"/dashboard?flash={quote('Danke fuer dein Feedback!')}")
    return redirect("/dashboard")
