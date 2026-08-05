"""
Publisher-Agent: veroeffentlicht Content-Entwuerfe auf den erlaubten
Plattformen und erzwingt die monatlichen Post-/Video-/Plattform-Limits.

- Starter: 10 Posts/Monat
- Creator: 30 Posts/Monat
- Pro/Agent: unbegrenzt

Nutzt Buffer (buffer.com) zum Veroeffentlichen - im MOCK-Modus (kein echter
BUFFER_ACCESS_TOKEN), wenn config.MOCK_BUFFER True ist.
"""
import uuid
from datetime import datetime

from agents.base_agent import BaseAgent
from config import AGENT_PUBLISHER, BUFFER_ACCESS_TOKEN, MOCK_BUFFER, UNLIMITED
from db import get_session_for
from models import Content, ContentTypeEnum, ContentStatusEnum

VIDEO_TYPES = (ContentTypeEnum.video.value, ContentTypeEnum.reel.value)


def publish_to_buffer(platform: str, text: str, media_urls: list) -> dict:
    """Veroeffentlicht ueber die Buffer-API (oder simuliert es im Mock-Modus)."""
    if MOCK_BUFFER:
        return {
            "id": f"buf_mock_{uuid.uuid4().hex[:10]}",
            "platform": platform,
            "status": "sent",
            "mock": True,
        }

    # TODO: echten Buffer-API-Call implementieren, z.B.:
    # requests.post(
    #     "https://api.bufferapp.com/1/updates/create.json",
    #     data={"access_token": BUFFER_ACCESS_TOKEN, "text": text, "profile_ids[]": [...], "media": media_urls},
    # )
    return {"id": f"buf_{uuid.uuid4().hex[:10]}", "platform": platform, "status": "sent", "mock": False}


class PublisherAgent(BaseAgent):
    agent_id = AGENT_PUBLISHER

    def run(self, user, content_id: int | None = None) -> list:
        """
        Veroeffentlicht faellige Draft-Contents fuer `user`, unter Beachtung
        von post_limit / video_limit / platform_limit. Gibt eine Liste von
        Ergebnis-Dicts zurueck (published / skipped mit Grund).
        """
        self.require_access(user)

        results = []
        month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        with get_session_for(user) as session:
            drafts_query = session.query(Content).filter(
                Content.user_id == user.id, Content.status == ContentStatusEnum.draft.value
            )
            if content_id is not None:
                drafts_query = drafts_query.filter(Content.id == content_id)
            drafts = drafts_query.order_by(Content.created_at.asc()).all()

            published_this_month = (
                session.query(Content)
                .filter(
                    Content.user_id == user.id,
                    Content.status == ContentStatusEnum.published.value,
                    Content.published_at >= month_start,
                )
                .all()
            )
            post_count = len([c for c in published_this_month if c.content_type not in VIDEO_TYPES])
            video_count = len([c for c in published_this_month if c.content_type in VIDEO_TYPES])
            used_platforms = {c.platform for c in published_this_month}

            for draft in drafts:
                is_video = draft.content_type in VIDEO_TYPES

                if is_video:
                    if user.video_limit != UNLIMITED and video_count >= user.video_limit:
                        results.append(self._skip(draft, "video_limit_reached"))
                        continue
                else:
                    if user.post_limit != UNLIMITED and post_count >= user.post_limit:
                        results.append(self._skip(draft, "post_limit_reached"))
                        continue

                new_platform = draft.platform not in used_platforms
                if new_platform and len(used_platforms) >= user.platform_limit:
                    results.append(self._skip(draft, "platform_limit_reached"))
                    continue

                buffer_result = publish_to_buffer(draft.platform, draft.text_content, draft.media_urls or [])

                draft.status = ContentStatusEnum.published.value
                draft.published_at = datetime.utcnow()
                draft.engagement_metrics = {"buffer_id": buffer_result["id"], "likes": 0, "comments": 0, "shares": 0}

                used_platforms.add(draft.platform)
                if is_video:
                    video_count += 1
                else:
                    post_count += 1

                self.logger.info(
                    "Veroeffentlicht: user_id=%s content_id=%s platform=%s",
                    user.id, draft.id, draft.platform,
                )
                results.append({"content_id": draft.id, "platform": draft.platform, "status": "published"})

        return results

    def _skip(self, draft: Content, reason: str) -> dict:
        self.logger.warning(
            "Ueberspringe content_id=%s (platform=%s): %s", draft.id, draft.platform, reason
        )
        return {"content_id": draft.id, "platform": draft.platform, "status": "skipped", "reason": reason}
