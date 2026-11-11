const _pending = new Set();
const _failed  = new Set();
const CACHE_MS = 20 * 60 * 60 * 1000; // 20h

// Try three oembed sources in order. noembed.com is first because it sends
// Access-Control-Allow-Origin itself (no proxy needed), so TikTok IP-blocking
// of generic proxies doesn't apply. The other two are fallbacks.
async function _oembed(videoUrl) {
  const enc    = encodeURIComponent(videoUrl);
  const direct = 'https://www.tiktok.com/oembed?url=' + enc;

  const sources = [
    // 1. noembed.com — oembed aggregator with native CORS support
    () => fetch('https://noembed.com/embed?url=' + enc,
                { signal: AbortSignal.timeout(8000) }),
    // 2. corsproxy.io — generic CORS proxy, different infrastructure than allorigins
    () => fetch('https://corsproxy.io/?' + encodeURIComponent(direct),
                { signal: AbortSignal.timeout(8000) }),
    // 3. allorigins — last resort
    () => fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(direct),
                { signal: AbortSignal.timeout(10000) }),
  ];

  for (const attempt of sources) {
    try {
      const res = await attempt();
      if (!res.ok) continue;
      const d = await res.json();
      if (d?.thumbnail_url) return d;
    } catch (_) {}
  }
  return null;
}

export function fetchMissingThumbnail(vid, videoUrl, currentThumb, thumbnailUpdated) {
  if (!vid || !videoUrl) return;
  if (!videoUrl.includes('tiktok.com')) return;
  if (_pending.has(vid) || _failed.has(vid)) return;
  if (currentThumb && thumbnailUpdated > Date.now() - CACHE_MS) return;

  _pending.add(vid);

  const delay = _pending.size * 600;
  setTimeout(async () => {
    try {
      const d = await _oembed(videoUrl);
      if (!d?.thumbnail_url) { _failed.add(vid); return; }

      const now = Date.now();
      const url = d.thumbnail_url;

      // 1. Update local state
      try {
        const { state } = await import('../state.js');
        if (state.db.videos?.[vid]) {
          state.db.videos[vid].thumbnail        = url;
          state.db.videos[vid].thumbnailUpdated = now;
          if (d.title)       state.db.videos[vid].videoTitle  = d.title;
          if (d.author_name) state.db.videos[vid].videoAuthor = d.author_name;
        }
      } catch (_) {}

      // 2. Update DOM in-place
      try {
        const escaped = CSS.escape(String(vid));
        document.querySelectorAll(`[data-vid="${escaped}"]`).forEach(wrap => {
          const img = wrap.querySelector('.vc-thumb');
          if (img) {
            img.src = url;
          } else {
            const fb = wrap.querySelector('.vc-thumb-fallback');
            if (fb) {
              const el = document.createElement('img');
              el.className      = 'vc-thumb';
              el.src            = url;
              el.alt            = '';
              el.loading        = 'lazy';
              el.referrerPolicy = 'no-referrer';
              el.onerror        = function() {
                this.outerHTML = '<div class="vc-thumb-fallback"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>';
              };
              fb.replaceWith(el);
            }
          }
        });
      } catch (_) {}

      // 3. Persist to Firebase
      const { writeDB } = await import('../firebase.js');
      writeDB(`videos/${vid}/thumbnail`,        url);
      writeDB(`videos/${vid}/thumbnailUpdated`, now);
      if (d.title)       writeDB(`videos/${vid}/videoTitle`,  d.title);
      if (d.author_name) writeDB(`videos/${vid}/videoAuthor`, d.author_name);

    } catch (_e) {
      // Network error — don't mark failed, retry next session
    } finally {
      _pending.delete(vid);
    }
  }, delay);
}
