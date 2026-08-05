"""
Internes Admin-Dashboard (Streamlit): MRR-Uebersicht, 90-Tage-Wachstumsziel,
Beta-Tester-Statistiken (Signup/letzter Login/Posts) und Feedback-Uebersicht.

Bewusst getrennt vom Kunden-Dashboard (dashboard.py) - hier gibt es kein
Login, da es nur lokal vom Betreiber selbst gestartet werden soll.

Start:
    streamlit run admin_dashboard.py --server.port 8502
"""
from datetime import datetime

import pandas as pd
import streamlit as st

from config import PLAN_CONFIG, PlanTier
from db import get_session
from models import Content, Feedback, User, enum_value
from mrr import compute_mrr, daily_mrr_report, mrr_goal_progress

st.set_page_config(page_title="Admin: Business-Metriken", page_icon="🧭", layout="wide")

st.title("🧭 Admin-Dashboard — Business-Metriken")
st.caption("Nur lokal, kein Login noetig. Nicht fuer Kunden gedacht.")

tab_mrr, tab_beta, tab_feedback = st.tabs(["MRR & Wachstumsziel", "Beta-Tester", "Feedback"])

# --------------------------------------------------------------------------
# Tab 1: MRR & Wachstumsziel
# --------------------------------------------------------------------------
with tab_mrr:
    report = daily_mrr_report()
    goal = mrr_goal_progress()

    st.subheader("Aktueller MRR")
    cols = st.columns(4)
    cols[0].metric("MRR gesamt", f"${report['mrr_total']:,.0f}")
    cols[1].metric("Tagesziel (Monat)", f"${report['target']:,.0f}",
                    delta=f"${report['mrr_total'] - report['target']:,.0f}")
    cols[2].metric("Aktive User", report["user_count"])
    cols[3].metric("Status", "🔴 Unter Ziel" if report["alarm"] else "🟢 Im Ziel")

    st.markdown("#### User pro Plan")
    plan_cols = st.columns(4)
    for i, tier in enumerate([PlanTier.STARTER, PlanTier.CREATOR, PlanTier.PRO, PlanTier.AGENT]):
        plan_cols[i].metric(
            PLAN_CONFIG[tier]["name"],
            report["counts"].get(tier.value, 0),
            help=f"${PLAN_CONFIG[tier]['price_usd']}/Monat",
        )

    st.divider()
    st.subheader(f"🎯 Wachstumsziel: ${goal['target_usd']:,.0f} in {goal['days_total']} Tagen")

    gcols = st.columns(4)
    gcols[0].metric("Tage bis Ziel", goal["days_left"])
    gcols[1].metric("Noch benoetigt", f"${goal['remaining_usd']:,.0f}")
    gcols[2].metric("Benoetigt/Tag", f"${goal['needed_per_day_usd']:,.0f}")
    gcols[3].metric("Auf Kurs?", "✅ Ja" if goal["on_track"] else "⚠️ Nein")

    progress = min(goal["current_usd"] / goal["target_usd"], 1.0) if goal["target_usd"] else 0
    st.progress(progress, text=f"${goal['current_usd']:,.0f} / ${goal['target_usd']:,.0f} MRR")

    st.markdown("#### Alternative: benoetigte Neu-User/Tag, je nach Plan-Mix")
    st.caption(
        "Diese Zahlen sind Alternativ-Szenarien (nicht kombiniert): "
        "z.B. entweder X neue Starter-User/Tag ODER Y neue Pro-User/Tag, "
        "um die Luecke bis zum Ziel-Datum zu schliessen."
    )
    plan_rows = [
        {"Plan": PLAN_CONFIG[PlanTier(p)]["name"], "Preis/Monat": f"${PLAN_CONFIG[PlanTier(p)]['price_usd']}",
         "Neu-User/Tag noetig": v}
        for p, v in goal["users_per_day_by_plan"].items()
    ]
    st.dataframe(pd.DataFrame(plan_rows), width='stretch', hide_index=True)

    if st.button("🔄 Neu berechnen"):
        st.rerun()

# --------------------------------------------------------------------------
# Tab 2: Beta-Tester
# --------------------------------------------------------------------------
with tab_beta:
    st.subheader("Beta-Tester-Uebersicht")
    with get_session() as session:
        beta_users = (
            session.query(User)
            .filter_by(plan=PlanTier.BETA.value)
            .order_by(User.created_at.desc())
            .all()
        )
        rows = []
        for u in beta_users:
            post_count = session.query(Content).filter_by(user_id=u.id).count()
            days_since_login = (
                (datetime.utcnow() - u.last_login_at).days if u.last_login_at else None
            )
            rows.append({
                "E-Mail": u.email,
                "Registriert": u.created_at.strftime("%Y-%m-%d"),
                "Letzter Login": u.last_login_at.strftime("%Y-%m-%d %H:%M") if u.last_login_at else "noch nie",
                "Tage seit Login": days_since_login if days_since_login is not None else "-",
                "Posts erstellt": post_count,
            })

    st.metric("Beta-Tester gesamt", len(rows))
    if rows:
        st.dataframe(pd.DataFrame(rows), width='stretch', hide_index=True)
        inactive = [r for r in rows if r["Tage seit Login"] == "-" or (isinstance(r["Tage seit Login"], int) and r["Tage seit Login"] >= 3)]
        if inactive:
            st.warning(f"⚠️ {len(inactive)} Beta-Tester haben sich seit ≥3 Tagen nicht eingeloggt (oder noch nie) — ggf. nachfassen.")
    else:
        st.info("Noch keine Beta-Tester registriert. Landing Page: http://localhost:4242/")

# --------------------------------------------------------------------------
# Tab 3: Feedback
# --------------------------------------------------------------------------
with tab_feedback:
    st.subheader("Eingegangenes Feedback")
    with get_session() as session:
        entries = (
            session.query(Feedback, User.email)
            .join(User, Feedback.user_id == User.id)
            .order_by(Feedback.created_at.desc())
            .all()
        )
        rows = [
            {
                "Datum": fb.created_at.strftime("%Y-%m-%d %H:%M"),
                "Kategorie": enum_value(fb.category),
                "User": email,
                "Nachricht": fb.message,
            }
            for fb, email in entries
        ]

    if rows:
        cat_counts = pd.DataFrame(rows)["Kategorie"].value_counts()
        cols = st.columns(3)
        cols[0].metric("🐞 Bugs", int(cat_counts.get("bug", 0)))
        cols[1].metric("✨ Feature-Wuensche", int(cat_counts.get("feature", 0)))
        cols[2].metric("💡 Ideen", int(cat_counts.get("idea", 0)))
        st.dataframe(pd.DataFrame(rows), width='stretch', hide_index=True)
    else:
        st.info("Noch kein Feedback vorhanden.")
