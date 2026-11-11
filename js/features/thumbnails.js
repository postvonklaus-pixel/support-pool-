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
        const now = Date.now();

        // Update local state immediately so re-render shows the thumbnail
        // without waiting for the RTDB listener echo
        try {
          const { state } = await import('../state.js');
          if (state.db.videos?.[vid]) {
            state.db.videos[vid].thumbnail        = d.thumbnail_url;
            state.db.videos[vid].thumbnailUpdated = now;
            if (d.title)       state.db.videos[vid].videoTitle  = d.title;
            if (d.author_name) state.db.videos[vid].videoAuthor = d.author_name;
          }
        } catch (_) {}

        // Update any existing <img class="vc-thumb"> in the DOM immediately
        try {
          const escaped = CSS.escape(String(vid));
          document.querySelectorAll(`[data-vid="${escaped}"] .vc-thumb`).forEach(img => {
            img.src = d.thumbnail_url;
          });
        } catch (_) {}

        // Write to Firebase so other users benefit on next load
        const { writeDB } = await import('../firebase.js');
        writeDB(`videos/${vid}/thumbnail`,        d.thumbnail_url);
        writeDB(`videos/${vid}/thumbnailUpdated`, now);
        if (d.title)       writeDB(`videos/${vid}/videoTitle`,  d.title);
        if (d.author_name) writeDB(`videos/${vid}/videoAuthor`, d.author_name);

        // Re-render active screen so fallback placeholders become real thumbnails
        try {
          const { renderActive } = await import('../router.js');
          renderActive({ debounce: true });
        } catch (_) {}
      } else {
        _failed.add(vid);
      }
    } catch (_e) {
      // Network/CORS error — don't permanently mark failed so next load retries
    } finally {
      _pending.delete(vid);
    }
  }, delay);
}
