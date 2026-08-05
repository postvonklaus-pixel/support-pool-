"""
Analytics-Agent: erfasst taegliche Kennzahlen und erstellt Reports.

- Starter: Basis-Report (woechentlich)
- Creator: Standard-Report (taeglich)
- Pro:     Erweiterter Report (Echtzeit, inkl. Post-Breakdown)
- Agent:   Voll-Report + KI-Empfehlungen
"""
import random
from datetime import date

from agents.base_agent import BaseAgent
from agents.content_creator import generate_text
from config import AGENT_ANALYTICS, PLAN_CONFIG, PlanTier
from db import get_session_for
from models import Analytics


def _generate_mock_metrics() -> dict:
    impressions = random.randint(500, 20000)
    reach = int(impressions * random.uniform(0.5, 0.9))
    clicks = int(impressions * random.uniform(0.01, 0.05))
    likes = int(impressions * random.uniform(0.02, 0.08))
    comments = int(likes * random.uniform(0.05, 0.2))
    shares = int(likes * random.uniform(0.02, 0.1))
    saves = int(likes * random.uniform(0.03, 0.15))
    follower_growth = random.randint(-5, 150)
    engagement_rate = round(((likes + comments + shares + saves) / max(impressions, 1)) * 100, 2)
    return {
        "impressions": impressions,
        "reach": reach,
        "clicks": clicks,
        "likes": likes,
        "comments": comments,
        "shares": shares,
        "saves": saves,
        "follower_growth": follower_growth,
        "engagement_rate": engagement_rate,
    }


class AnalyticsAgent(BaseAgent):
    agent_id = AGENT_ANALYTICS

    def run(self, user, platform: str = "instagram") -> dict:
        self.require_access(user)

        cfg = PLAN_CONFIG[PlanTier(user.plan)]
        level = cfg["analytics_level"]
        frequency = cfg["analytics_frequency"]
        metrics = _generate_mock_metrics()

        with get_session_for(user) as session:
            record = Analytics(
                user_id=user.id,
                date=date.today(),
                platform=platform,
                **metrics,
            )
            session.add(record)
            session.flush()
            record_id = record.id

        report = {
            "record_id": record_id,
            "platform": platform,
            "level": level,
            "frequency": frequency,
            "metrics": metrics,
        }

        if level == "basic":
            report["summary"] = (
                f"Woechentlicher Basis-Report: {metrics['impressions']} Impressions, "
                f"{metrics['engagement_rate']}% Engagement-Rate."
            )
        elif level == "standard":
            report["summary"] = (
                f"Taeglicher Report: {metrics['impressions']} Impressions, {metrics['reach']} Reach, "
                f"{metrics['engagement_rate']}% Engagement-Rate, {metrics['follower_growth']} neue Follower."
            )
        elif level == "advanced":
            report["summary"] = (
                f"Echtzeit-Report: {metrics['impressions']} Impressions, {metrics['reach']} Reach, "
                f"{metrics['clicks']} Klicks, {metrics['engagement_rate']}% Engagement-Rate."
            )
            report["breakdown"] = {
                "likes": metrics["likes"], "comments": metrics["comments"],
                "shares": metrics["shares"], "saves": metrics["saves"],
            }
        elif level == "full":
            report["summary"] = (
                f"Voll-Report: {metrics['impressions']} Impressions, {metrics['reach']} Reach, "
                f"{metrics['engagement_rate']}% Engagement-Rate, {metrics['follower_growth']} neue Follower."
            )
            report["breakdown"] = {
                "likes": metrics["likes"], "comments": metrics["comments"],
                "shares": metrics["shares"], "saves": metrics["saves"],
            }
            report["recommendations"] = generate_text(
                f"Gib 2 kurze, konkrete Wachstums-Empfehlungen basierend auf "
                f"{metrics['engagement_rate']}% Engagement-Rate und {metrics['follower_growth']} Follower-Wachstum.",
                platform,
            )

        self.logger.info("Analytics-Report erstellt: user_id=%s level=%s platform=%s", user.id, level, platform)
        return report
