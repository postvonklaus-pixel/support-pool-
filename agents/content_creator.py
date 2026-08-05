"""
Content-Creator-Agent: generiert Content-Entwuerfe (Status "draft") je nach
Plan-Faehigkeiten.

- Starter: nur Text
- Creator: Text + einfache Bilder
- Pro:     Text + Bilder + Carousels
- Agent:   Alles + Video-Skripte

Nutzt OpenAI (Text) und Replicate (Bilder) - beide im MOCK-Modus, wenn keine
echten API-Keys gesetzt sind (config.MOCK_OPENAI / config.MOCK_REPLICATE).
"""
import random
import uuid

from agents.base_agent import BaseAgent
from config import AGENT_CONTENT_CREATOR, MOCK_OPENAI, MOCK_REPLICATE, OPENAI_API_KEY, PlanTier
from db import get_session_for
from models import Content, ContentTypeEnum, enum_value

if not MOCK_OPENAI:
    from openai import OpenAI

    _openai_client = OpenAI(api_key=OPENAI_API_KEY)
else:
    _openai_client = None

if not MOCK_REPLICATE:
    import replicate
else:
    replicate = None  # type: ignore


DEFAULT_HASHTAGS = ["#ai", "#socialmedia", "#growth", "#automation", "#marketing"]


def generate_text(topic: str, platform: str) -> str:
    """Erstellt einen Post-Text via OpenAI (oder Mock)."""
    prompt = f"Schreibe einen ansprechenden {platform}-Post ueber: {topic}"
    if MOCK_OPENAI:
        return f"[MOCK-TEXT] {topic} — spannende Insights fuer {platform}! 🚀 (generiert {uuid.uuid4().hex[:6]})"

    # TODO: Modellname/Parameter bei Bedarf ueber .env konfigurierbar machen.
    response = _openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content.strip()


def generate_image(prompt: str) -> str:
    """Erstellt ein Bild via Replicate (oder Mock) und gibt eine Media-URL zurueck."""
    if MOCK_REPLICATE:
        return f"https://mock-cdn.local/images/{uuid.uuid4().hex}.png"

    # TODO: konkretes Modell (z.B. stability-ai/sdxl) und Parameter waehlen.
    output = replicate.run(
        "stability-ai/sdxl:latest",
        input={"prompt": prompt},
    )
    return output[0] if isinstance(output, list) else str(output)


def generate_video_script(topic: str) -> str:
    if MOCK_OPENAI:
        return (
            f"[MOCK-VIDEO-SKRIPT] Hook: '{topic} in 15 Sekunden!'\n"
            f"Szene 1: Problem zeigen.\nSzene 2: Loesung praesentieren.\n"
            f"Szene 3: Call-to-Action."
        )
    response = _openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": f"Schreibe ein kurzes Kurzvideo-Skript ueber: {topic}"}],
    )
    return response.choices[0].message.content.strip()


class ContentCreatorAgent(BaseAgent):
    agent_id = AGENT_CONTENT_CREATOR

    def run(self, user, platform: str = "instagram", topic: str = "Produkt-Update", content_type: str = "post"):
        """
        Erstellt einen Content-Entwurf fuer `user` und speichert ihn als
        Content mit status="draft". Gibt das erstellte Content-Objekt (als
        dict) zurueck oder None, wenn kein Zugriff besteht.
        """
        self.require_access(user)

        plan = PlanTier(user.plan)
        text = generate_text(topic, platform)
        media_urls = []
        resolved_type = ContentTypeEnum.post

        if content_type == "carousel" and plan in (PlanTier.PRO, PlanTier.AGENT):
            resolved_type = ContentTypeEnum.carousel
            media_urls = [generate_image(f"{topic} slide {i+1}") for i in range(3)]
        elif content_type == "video" and plan == PlanTier.AGENT:
            resolved_type = ContentTypeEnum.video
            text = generate_video_script(topic)
        elif plan in (PlanTier.CREATOR, PlanTier.PRO, PlanTier.AGENT):
            # Creator und hoeher duerfen (einfache) Bilder zu Text-Posts hinzufuegen.
            resolved_type = ContentTypeEnum.post
            media_urls = [generate_image(topic)]
        else:
            # Starter: ausschliesslich Text, kein Bild.
            resolved_type = ContentTypeEnum.post
            media_urls = []

        hashtags = random.sample(DEFAULT_HASHTAGS, k=min(3, len(DEFAULT_HASHTAGS)))

        with get_session_for(user) as session:
            content = Content(
                user_id=user.id,
                platform=platform,
                content_type=resolved_type.value,
                text_content=text,
                media_urls=media_urls,
                hashtags=hashtags,
                status="draft",
            )
            session.add(content)
            session.flush()
            self.logger.info(
                "Content erstellt: user_id=%s platform=%s type=%s (id=%s)",
                user.id, platform, resolved_type.value, content.id,
            )
            return {
                "id": content.id,
                "platform": content.platform,
                "content_type": enum_value(content.content_type),
                "text_content": content.text_content,
                "media_urls": content.media_urls,
                "hashtags": content.hashtags,
                "status": enum_value(content.status),
            }
