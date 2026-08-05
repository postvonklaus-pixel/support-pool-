"""Basis-Klasse fuer alle KI-Agenten."""
import logging

from models import User, enum_value

logger = logging.getLogger(__name__)


class AgentAccessDenied(Exception):
    """Wird geworfen, wenn ein User keinen Zugriff auf diesen Agenten hat."""


class BaseAgent:
    """
    Basis-Klasse fuer alle Agenten (ContentCreator, Publisher, Engagement,
    Analytics, Growth).

    Jeder Agent hat eine eindeutige `name` (== Agenten-ID, z.B. "publisher"),
    die mit den IDs in User.agent_access bzw. config.PLAN_CONFIG[...]["agents"]
    uebereinstimmt.
    """

    #: Muss von Subklassen auf eine der config.AGENT_* Konstanten gesetzt werden.
    agent_id: str = "base"

    def __init__(self, name: str, config: dict | None = None):
        self.name = name
        self.config = config or {}
        self.logger = logging.getLogger(f"agents.{name}")

    def check_access(self, user: User) -> bool:
        """Prueft, ob der User diesen Agenten laut Plan und Abo-Status nutzen darf."""
        if user is None:
            return False

        agent_access = user.agent_access or []
        if self.agent_id not in agent_access:
            self.logger.debug(
                "Zugriff verweigert: user_id=%s hat keinen Zugriff auf Agent '%s' (Plan=%s)",
                user.id, self.agent_id, enum_value(user.plan),
            )
            return False

        # Nur bei aktivem Abo oder innerhalb der Grace-Period (past_due) laufen
        # Agenten. Bei expired/canceled ist nur Lesezugriff erlaubt.
        if user.is_read_only():
            self.logger.debug(
                "Zugriff verweigert: user_id=%s hat abgelaufenes/gekuendigtes Abo (status=%s)",
                user.id, enum_value(user.subscription_status),
            )
            return False

        return True

    def require_access(self, user: User) -> None:
        if not self.check_access(user):
            raise AgentAccessDenied(
                f"User {getattr(user, 'id', None)} hat keinen Zugriff auf Agent '{self.agent_id}'"
            )

    def run(self, user: User):
        """Muss von jeder Subklasse ueberschrieben werden."""
        raise NotImplementedError("Subklassen muessen run() implementieren")

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} id={self.agent_id}>"
