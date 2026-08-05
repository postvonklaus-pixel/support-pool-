"""
Engagement-Agent: reagiert auf Kommentare und Direktnachrichten.

- Starter: kein Engagement (Agent nicht freigeschaltet)
- Creator: Basis - nur Kommentare lesen (keine automatischen Antworten)
- Pro:     Voll - Kommentare + DMs automatisch beantworten
- Agent:   Voll + Lead-Identifikation in DMs
"""
import random
import uuid

from agents.base_agent import BaseAgent
from agents.content_creator import generate_text
from config import AGENT_ENGAGEMENT, PLAN_CONFIG, PlanTier

LEAD_KEYWORDS = ("preis", "price", "buchen", "kaufen", "demo", "interessiert", "angebot", "kontakt")

_MOCK_COMMENTS = [
    "Tolles Produkt, wie viel kostet das?",
    "Liebe den Content! 🔥",
    "Kann man das auch fuer B2B nutzen?",
    "Wo kann ich mehr erfahren?",
]
_MOCK_DMS = [
    "Hi, ich bin interessiert an einer Demo, was kostet euer Pro-Plan?",
    "Danke fuer den Post, sehr hilfreich!",
    "Wollt ihr eine Kooperation? Bitte Kontakt aufnehmen.",
]


def _fetch_comments(platform: str) -> list:
    return [{"id": uuid.uuid4().hex[:8], "platform": platform, "text": random.choice(_MOCK_COMMENTS)} for _ in range(3)]


def _fetch_dms(platform: str) -> list:
    return [{"id": uuid.uuid4().hex[:8], "platform": platform, "text": random.choice(_MOCK_DMS)} for _ in range(2)]


class EngagementAgent(BaseAgent):
    agent_id = AGENT_ENGAGEMENT

    def run(self, user, platform: str = "instagram") -> dict:
        self.require_access(user)

        level = PLAN_CONFIG[PlanTier(user.plan)]["engagement_level"]
        comments = _fetch_comments(platform)
        result = {"platform": platform, "level": level, "comments_read": len(comments), "replies_sent": 0, "leads": []}

        if level == "basic":
            self.logger.info("Engagement (basic): %d Kommentare gelesen, keine Antworten (Plan-Limit).", len(comments))
            return result

        if level in ("full", "full_leads"):
            for comment in comments:
                reply = generate_text(f"Antwort auf Kommentar: '{comment['text']}'", platform)
                self.logger.info("Kommentar beantwortet (content=%s): %s", comment["id"], reply[:60])
                result["replies_sent"] += 1

            dms = _fetch_dms(platform)
            for dm in dms:
                reply = generate_text(f"Antwort auf DM: '{dm['text']}'", platform)
                self.logger.info("DM beantwortet (dm=%s): %s", dm["id"], reply[:60])
                result["replies_sent"] += 1

                if level == "full_leads" and any(kw in dm["text"].lower() for kw in LEAD_KEYWORDS):
                    result["leads"].append({"dm_id": dm["id"], "text": dm["text"], "platform": platform})

            if level == "full_leads" and result["leads"]:
                self.logger.info("Leads identifiziert: %d", len(result["leads"]))

        return result
