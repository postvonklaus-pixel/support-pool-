const _pending  = new Set();
const _failed   = new Set();
const CACHE_MS  = 20 * 60 * 60 * 1000; // 20h

// Free CORS proxy — TikTok oembed blocks direct browser fetches (no CORS headers)
const PROXY = 'https://api.allorigins.win/raw?url=';

export function fetchMissingThumbnail(vid, videoUrl, currentThumb, thumbnailUpdated) {
  if (!vid || !videoUrl) return;
  if (!videoUrl.includes('tiktok.com')) return;
  if (_pending.has(vid) || _failed.has(vid)) return;
  if (currentThumb && thumbnailUpdated > Date.now() - CACHE_MS) return;

  _pending.add(vid);

  const delay = _pending.size * 600;
  setTimeout(async () => {
    try {
      const oembedUrl = 'https://www.tiktok.com/oembed?url=' + encodeURIComponent(videoUrl);
      const res = await fetch(PROXY + encodeURIComponent(oembedUrl), {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) { _failed.add(vid); return; }
      const d = await res.json();
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
              el.className = 'vc-thumb';
              el.src       = url;
              el.alt       = '';
              el.loading   = 'lazy';
              el.referrerPolicy = 'no-referrer';
              el.onerror   = function() {
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
      // Network error or proxy down — don't mark failed, retry next session
    } finally {
      _pending.delete(vid);
    }
  }, delay);
}
