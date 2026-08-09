"""
Growth-Agent: NUR im Agent-Plan ($999) verfuegbar.

- Findet potenzielle neue Follower (Ziel-Zielgruppen-Suche)
- Analysiert Konkurrenz-Accounts
- Erstellt KI-gestuetzte Wachstumsstrategien
"""
import random
import uuid

from agents.base_agent import BaseAgent
from agents.content_creator import generate_text
from config import AGENT_GROWTH
from db import get_session_for
from models import GrowthStrategy

_MOCK_HANDLES = ["@growth_jane", "@techfounder", "@creator_max", "@marketing_lisa", "@startup_ben"]


def _find_target_followers(platform: str, niche: str) -> list:
    return [
        {"handle": handle, "platform": platform, "relevance_score": round(random.uniform(0.6, 0.98), 2)}
        for handle in random.sample(_MOCK_HANDLES, k=3)
    ]


def _analyze_competitors(platform: str, competitors: list) -> list:
    return [
        {
            "handle": comp,
            "platform": platform,
            "avg_engagement_rate": round(random.uniform(1.5, 6.0), 2),
            "posting_frequency_per_week": random.randint(3, 14),
        }
        for comp in competitors
    ]


class GrowthAgent(BaseAgent):
    agent_id = AGENT_GROWTH

    def run(self, user, platform: str = "instagram", niche: str = "SaaS", competitors: list | None = None) -> dict:
        self.require_access(user)

        competitors = competitors or ["@competitor_a", "@competitor_b"]

        targets = _find_target_followers(platform, niche)
        competitor_analysis = _analyze_competitors(platform, competitors)

        strategy_prompt = (
            f"Erstelle eine kurze Wachstumsstrategie fuer einen {niche}-Account auf {platform}, "
            f"basierend auf {len(competitor_analysis)} analysierten Konkurrenten."
        )
        strategy = generate_text(strategy_prompt, platform)

        with get_session_for(user) as session:
            record = GrowthStrategy(
                user_id=user.id,
                platform=platform,
                niche=niche,
                target_followers=targets,
                competitor_analysis=competitor_analysis,
                strategy_text=strategy,
            )
            session.add(record)
            session.flush()
            record_id = record.id

        result = {
            "id": uuid.uuid4().hex[:10],
            "record_id": record_id,
            "platform": platform,
            "target_followers": targets,
            "competitor_analysis": competitor_analysis,
            "growth_strategy": strategy,
        }
        self.logger.info(
            "Growth-Analyse fuer user_id=%s abgeschlossen: %d Ziel-Follower, %d Konkurrenten analysiert",
            user.id, len(targets), len(competitor_analysis),
        )
        return result
