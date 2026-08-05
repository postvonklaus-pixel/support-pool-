"""
Streamlit-Dashboard fuer User: Login, Plan-Uebersicht, Content, Analytics,
Plan-Upgrade/Downgrade mit Stripe-Checkout (Mock-Modus faehig).

Start:
    streamlit run dashboard.py
"""
import pandas as pd
import streamlit as st

import payment
from auth import verify_password
from config import MOCK_STRIPE, PLAN_CONFIG, PlanTier
from db import get_session, init_db
from models import Analytics, Content, User, enum_value

init_db()

st.set_page_config(page_title="Social Media Automation Dashboard", page_icon="📈", layout="wide")


def _load_user(email: str) -> User | None:
    with get_session() as session:
        user = session.query(User).filter_by(email=email).first()
        if user:
            session.expunge(user)
        return user


def login_view() -> None:
    st.title("📈 KI-Social-Media-Automation — Login")
    st.caption("Demo-Login: nutze einen der Seed-User, z.B. user_pro@test.com / testpassword123")

    with st.form("login_form"):
        email = st.text_input("E-Mail")
        password = st.text_input("Passwort", type="password")
        submitted = st.form_submit_button("Login")

    if submitted:
        user = _load_user(email)
        if user and verify_password(password, user.password_hash):
            st.session_state["user_id"] = user.id
            st.session_state["email"] = user.email
            st.rerun()
        else:
            st.error("E-Mail oder Passwort falsch.")


def _plan_badge(plan: str) -> str:
    colors = {"starter": "🟢", "creator": "🔵", "pro": "🟣", "agent": "🟠"}
    return f"{colors.get(plan, '⚪')} {PLAN_CONFIG[PlanTier(plan)]['name']}"


def sidebar_view(user: User) -> None:
    with st.sidebar:
        st.markdown(f"### 👤 {user.email}")
        st.markdown(f"**Plan:** {_plan_badge(user.plan)}")
        st.markdown(f"**Status:** `{enum_value(user.subscription_status)}`")
        if user.is_read_only():
            st.warning("Abo abgelaufen — nur Lesezugriff.")
        if st.button("Logout"):
            st.session_state.clear()
            st.rerun()


def usage_view(user_id: int) -> None:
    st.subheader("Verbrauch vs. Plan-Limits")
    usage = payment.check_plan_limits(user_id)

    def fmt_limit(limit: int) -> str:
        return "∞" if limit == -1 else str(limit)

    cols = st.columns(4)
    cols[0].metric("Plattformen", f"{usage['platform_count']} / {fmt_limit(usage['platform_limit'])}")
    cols[1].metric("Posts (Monat)", f"{usage['post_count']} / {fmt_limit(usage['post_limit'])}")
    cols[2].metric("Videos (Monat)", f"{usage['video_count']} / {fmt_limit(usage['video_limit'])}")
    cols[3].metric("Agenten", f"{usage['agent_count']} / {fmt_limit(usage['agent_limit'])}")


def content_view(user_id: int) -> None:
    st.subheader("Content-Uebersicht")
    with get_session() as session:
        contents = (
            session.query(Content)
            .filter_by(user_id=user_id)
            .order_by(Content.created_at.desc())
            .limit(50)
            .all()
        )
        rows = [
            {
                "ID": c.id,
                "Plattform": c.platform,
                "Typ": enum_value(c.content_type),
                "Status": enum_value(c.status),
                "Text": (c.text_content or "")[:80],
                "Geplant": c.scheduled_at,
                "Veroeffentlicht": c.published_at,
            }
            for c in contents
        ]
    if rows:
        st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)
    else:
        st.info("Noch kein Content vorhanden. Nutze `python cli.py generate-content --user-id ...`.")


def analytics_view(user_id: int) -> None:
    st.subheader("Analytics-Dashboard")
    with get_session() as session:
        records = (
            session.query(Analytics)
            .filter_by(user_id=user_id)
            .order_by(Analytics.date.asc())
            .all()
        )
        rows = [
            {
                "Datum": r.date,
                "Plattform": r.platform,
                "Impressions": r.impressions,
                "Reach": r.reach,
                "Engagement-Rate": r.engagement_rate,
                "Follower-Wachstum": r.follower_growth,
            }
            for r in records
        ]
    if rows:
        df = pd.DataFrame(rows)
        col1, col2 = st.columns(2)
        with col1:
            st.line_chart(df.set_index("Datum")[["Impressions", "Reach"]])
        with col2:
            st.line_chart(df.set_index("Datum")[["Engagement-Rate"]])
        st.dataframe(df, use_container_width=True, hide_index=True)
    else:
        st.info("Noch keine Analytics-Daten. Fuehre den Analytics-Agenten aus (z.B. via workflow.py).")


def billing_view(user: User) -> None:
    st.subheader("Abo & Zahlungen")
    st.write(f"Aktueller Plan: **{_plan_badge(user.plan)}** (${PLAN_CONFIG[PlanTier(user.plan)]['price_usd']}/Monat)")

    if MOCK_STRIPE:
        st.caption("⚠️ MOCK-Modus: Es werden keine echten Zahlungen verarbeitet (kein STRIPE_SECRET_KEY gesetzt).")

    st.markdown("#### Plan wechseln")
    target_plans = [p for p in PlanTier if p.value != user.plan]
    plan_choice = st.selectbox(
        "Neuer Plan",
        options=[p.value for p in target_plans],
        format_func=lambda v: f"{PLAN_CONFIG[PlanTier(v)]['name']} (${PLAN_CONFIG[PlanTier(v)]['price_usd']}/Monat)",
    )

    col1, col2 = st.columns(2)
    with col1:
        if st.button("Stripe-Checkout starten"):
            result = payment.create_checkout_session(user.id, plan_choice)
            st.success(f"Checkout-Session erstellt: {result['id']}")
            st.link_button("Zur Bezahlung", result["url"])
    with col2:
        if st.button("Plan sofort wechseln (Mock-Upgrade)"):
            result = payment.upgrade_plan(user.id, plan_choice)
            st.success(f"Plan gewechselt: {result['old_plan']} -> {result['new_plan']}")
            st.rerun()

    if st.button("Abo kuendigen", type="secondary"):
        payment.cancel_subscription(user.id)
        st.warning("Abo gekuendigt.")
        st.rerun()

    st.markdown("#### Rechnungshistorie")
    invoices = payment.get_invoice_history(user.id)
    if invoices:
        st.dataframe(pd.DataFrame(invoices), use_container_width=True, hide_index=True)
    else:
        st.info("Noch keine Rechnungen vorhanden.")


def main() -> None:
    if "user_id" not in st.session_state:
        login_view()
        return

    with get_session() as session:
        user = session.get(User, st.session_state["user_id"])
        if user:
            session.expunge(user)

    if not user:
        st.session_state.clear()
        st.rerun()
        return

    sidebar_view(user)
    st.title("📊 Dein Social-Media-Automation-Dashboard")

    tab_usage, tab_content, tab_analytics, tab_billing = st.tabs(
        ["Verbrauch", "Content", "Analytics", "Abo & Zahlungen"]
    )
    with tab_usage:
        usage_view(user.id)
    with tab_content:
        content_view(user.id)
    with tab_analytics:
        analytics_view(user.id)
    with tab_billing:
        billing_view(user)


if __name__ == "__main__":
    main()
