"""KI-Agenten-Paket: Content Creator, Publisher, Engagement, Analytics, Growth."""
from agents.analytics import AnalyticsAgent
from agents.base_agent import BaseAgent
from agents.content_creator import ContentCreatorAgent
from agents.engagement import EngagementAgent
from agents.growth import GrowthAgent
from agents.publisher import PublisherAgent

AGENT_REGISTRY = {
    "content_creator": ContentCreatorAgent,
    "publisher": PublisherAgent,
    "engagement": EngagementAgent,
    "analytics": AnalyticsAgent,
    "growth": GrowthAgent,
}


def build_agents(config: dict | None = None) -> dict:
    """Instanziiert alle 5 Agenten und gibt sie als {agent_id: instance} zurueck."""
    config = config or {}
    return {agent_id: cls(name=agent_id, config=config) for agent_id, cls in AGENT_REGISTRY.items()}


__all__ = [
    "BaseAgent",
    "ContentCreatorAgent",
    "PublisherAgent",
    "EngagementAgent",
    "AnalyticsAgent",
    "GrowthAgent",
    "AGENT_REGISTRY",
    "build_agents",
]
