/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Client-side thumbnail fetching
   Calls TikTok oEmbed from the user's browser (no IP blocking).
   Writes thumbnail URLs back to Firebase for all users to benefit.
   ═══════════════════════════════════════════════════════ */

const _pending  = new Set();
const _failed   = new Set();
const CACHE_MS  = 20 * 60 * 60 * 1000; // 20h

export function fetchMissingThumbnail(vid, videoUrl, currentThumb, thumbnailUpdated) {
  if (!vid || !videoUrl) return;
  if (!videoUrl.includes('tiktok.com')) return;
  if (_pending.has(vid) || _failed.has(vid)) return;
  if (currentThumb && thumbnailUpdated > Date.now() - CACHE_MS) return;

  _pending.add(vid);

  // Stagger requests to avoid rate-limiting TikTok
  const delay = _pending.size * 400;
  setTimeout(async () => {
    try {
      const res = await fetch(
        'https://www.tiktok.com/oembed?url=' + encodeURIComponent(videoUrl),
        { headers: { 'Accept': 'application/json' } }
      );
      if (!res.ok) { _failed.add(vid); return; }
      const d = await res.json();
      if (d?.thumbnail_url) {
        const { writeDB } = await import('../firebase.js');
        const now = Date.now();
        writeDB(`videos/${vid}/thumbnail`,        d.thumbnail_url);
        writeDB(`videos/${vid}/thumbnailUpdated`, now);
        if (d.title)       writeDB(`videos/${vid}/videoTitle`,  d.title);
        if (d.author_name) writeDB(`videos/${vid}/videoAuthor`, d.author_name);
      } else {
        _failed.add(vid);
      }
    } catch (e) {
      _failed.add(vid);
    } finally {
      _pending.delete(vid);
    }
  }, delay);
}
