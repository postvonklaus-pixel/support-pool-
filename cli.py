"""
CLI fuer das KI-Social-Media-Automation-System.

Beispiele:
    python cli.py create-user --email test@test.com --plan starter
    python cli.py list-users
    python cli.py generate-content --user-id 1
    python cli.py show-usage --user-id 1
    python cli.py run-workflow --user-id 1
"""
import logging

import click

import payment
from agents import build_agents
from agents.base_agent import AgentAccessDenied
from agents.content_creator import ContentCreatorAgent
from auth import hash_password
from config import PLAN_CONFIG, PlanTier
from db import get_session, init_db
from email_service import send_welcome_email
from logging_config import setup_logging
from models import User, enum_value
from workflow import PIPELINE_ORDER

setup_logging()
logger = logging.getLogger("cli")


@click.group()
def cli():
    """KI-Social-Media-Automation-System - Kommandozeilen-Tool."""
    init_db()


@cli.command("create-user")
@click.option("--email", required=True, help="E-Mail-Adresse des neuen Users.")
@click.option("--plan", required=True, type=click.Choice([p.value for p in PlanTier]), help="Abo-Plan.")
@click.option("--password", default="testpassword123", show_default=True, help="Passwort (nur fuer Demo-Zwecke).")
def create_user(email: str, plan: str, password: str):
    """Legt einen neuen User mit dem gewaehlten Plan an."""
    plan_tier = PlanTier(plan)
    cfg = PLAN_CONFIG[plan_tier]

    with get_session() as session:
        existing = session.query(User).filter_by(email=email).first()
        if existing:
            click.echo(f"Fehler: User mit E-Mail {email} existiert bereits (id={existing.id}).", err=True)
            raise SystemExit(1)

        user = User(
            email=email,
            password_hash=hash_password(password),
            plan=plan_tier.value,
            platform_limit=cfg["platform_limit"],
            post_limit=cfg["post_limit"],
            video_limit=cfg["video_limit"],
            agent_access=list(cfg["agents"]),
            subscription_status="active",
        )
        session.add(user)
        session.flush()
        user_id = user.id

    send_welcome_email(email, plan_tier.value)
    click.echo(f"User erstellt: id={user_id} email={email} plan={plan_tier.value}")


@cli.command("list-users")
def list_users():
    """Listet alle User mit Plan und Abo-Status auf."""
    with get_session() as session:
        users = session.query(User).order_by(User.id).all()
        if not users:
            click.echo("Keine User vorhanden.")
            return
        click.echo(f"{'ID':<5}{'E-Mail':<28}{'Plan':<10}{'Status':<12}{'Erstellt':<20}")
        click.echo("-" * 75)
        for u in users:
            click.echo(
                f"{u.id:<5}{u.email:<28}{enum_value(u.plan):<10}{enum_value(u.subscription_status):<12}"
                f"{u.created_at.strftime('%Y-%m-%d %H:%M'):<20}"
            )


@cli.command("generate-content")
@click.option("--user-id", required=True, type=int, help="ID des Users, fuer den Content generiert wird.")
@click.option("--platform", default="instagram", show_default=True)
@click.option("--topic", default="Produkt-Update", show_default=True)
@click.option(
    "--content-type",
    default="post",
    show_default=True,
    type=click.Choice(["post", "carousel", "video"]),
)
def generate_content(user_id: int, platform: str, topic: str, content_type: str):
    """Laesst den Content-Creator-Agenten fuer einen User einen Entwurf erstellen."""
    with get_session() as session:
        user = session.get(User, user_id)
        if not user:
            click.echo(f"Fehler: User {user_id} nicht gefunden.", err=True)
            raise SystemExit(1)

        agent = ContentCreatorAgent(name="content_creator", config={})
        try:
            content = agent.run(user, platform=platform, topic=topic, content_type=content_type)
        except Exception as exc:
            click.echo(f"Fehler bei der Content-Generierung: {exc}", err=True)
            raise SystemExit(1)

    click.echo("Content-Entwurf erstellt:")
    for key, value in content.items():
        click.echo(f"  {key}: {value}")


@cli.command("show-usage")
@click.option("--user-id", required=True, type=int, help="ID des Users, dessen Verbrauch angezeigt wird.")
def show_usage(user_id: int):
    """Zeigt den aktuellen Verbrauch (Plattformen/Posts/Videos/Agenten) vs. Plan-Limits."""
    try:
        usage = payment.check_plan_limits(user_id)
    except payment.PaymentError as exc:
        click.echo(f"Fehler: {exc}", err=True)
        raise SystemExit(1)

    def fmt_limit(limit: int) -> str:
        return "unbegrenzt" if limit == -1 else str(limit)

    click.echo(f"Verbrauch fuer User {user_id} (Plan: {usage['plan']}, Status: {usage['subscription_status']})")
    click.echo(f"  Plattformen : {usage['platform_count']} / {fmt_limit(usage['platform_limit'])}")
    click.echo(f"  Posts       : {usage['post_count']} / {fmt_limit(usage['post_limit'])}")
    click.echo(f"  Videos      : {usage['video_count']} / {fmt_limit(usage['video_limit'])}")
    click.echo(f"  Agenten     : {usage['agent_count']} / {fmt_limit(usage['agent_limit'])}")
    if usage["is_read_only"]:
        click.echo("  Hinweis: Abo abgelaufen -> nur Lesezugriff, keine neuen Posts moeglich.")


@cli.command("run-workflow")
@click.option("--user-id", required=True, type=int, help="ID des Users, fuer den die Agenten-Pipeline laeuft.")
def run_workflow(user_id: int):
    """
    Fuehrt die Agenten-Pipeline (Content Creator -> Publisher -> Engagement ->
    Analytics -> Growth) einmalig fuer einen einzelnen User aus - nur die
    Agenten, die laut Plan freigeschaltet sind, und nur bei aktivem Abo
    (bzw. innerhalb der Grace-Period).
    """
    agents = build_agents()

    with get_session() as session:
        user = session.get(User, user_id)
        if not user:
            click.echo(f"Fehler: User {user_id} nicht gefunden.", err=True)
            raise SystemExit(1)

        if user.is_read_only():
            click.echo(
                f"User {user_id} hat Status '{enum_value(user.subscription_status)}' -> "
                f"nur Lesezugriff, Pipeline wird nicht ausgefuehrt."
            )
            return

        click.echo(f"Starte Pipeline fuer User {user_id} (Plan: {enum_value(user.plan)})...")
        for agent_id in PIPELINE_ORDER:
            if agent_id not in (user.agent_access or []):
                click.echo(f"  - {agent_id}: uebersprungen (nicht im Plan enthalten)")
                continue
            agent = agents[agent_id]
            try:
                result = agent.run(user)
                click.echo(f"  - {agent_id}: OK -> {result}")
            except AgentAccessDenied as exc:
                click.echo(f"  - {agent_id}: Zugriff verweigert ({exc})")
            except Exception as exc:
                click.echo(f"  - {agent_id}: FEHLER -> {exc}", err=True)

    click.echo("Pipeline abgeschlossen.")


if __name__ == "__main__":
    cli()
