const _pending  = new Set();
const _failed   = new Set();
const CACHE_MS  = 20 * 60 * 60 * 1000; // 20h

export function fetchMissingThumbnail(vid, videoUrl, currentThumb, thumbnailUpdated) {
  if (!vid || !videoUrl) return;
  if (!videoUrl.includes('tiktok.com')) return;
  if (_pending.has(vid) || _failed.has(vid)) return;
  if (currentThumb && thumbnailUpdated > Date.now() - CACHE_MS) return;

  _pending.add(vid);

  // Stagger requests to avoid hammering the Cloud Function
  const delay = _pending.size * 600;
  setTimeout(async () => {
    try {
      // TikTok oembed doesn't support CORS — use Cloud Function as proxy
      const { callFn } = await import('../firebase.js');
      const d = await callFn('fetchTikTokThumb', { url: videoUrl });
      if (d?.thumbnailUrl) {
        const now = Date.now();
        const url = d.thumbnailUrl;

        // 1. Update local state so the next scheduled render picks it up
        try {
          const { state } = await import('../state.js');
          if (state.db.videos?.[vid]) {
            state.db.videos[vid].thumbnail        = url;
            state.db.videos[vid].thumbnailUpdated = now;
            if (d.title)       state.db.videos[vid].videoTitle  = d.title;
            if (d.authorName)  state.db.videos[vid].videoAuthor = d.authorName;
          }
        } catch (_) {}

        // 2. Update DOM in-place — works for both existing <img> and fallback <div>
        //    to avoid triggering a full re-render that causes flicker/loops
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

        // 3. Persist to Firebase so other users benefit immediately
        const { writeDB } = await import('../firebase.js');
        writeDB(`videos/${vid}/thumbnail`,        url);
        writeDB(`videos/${vid}/thumbnailUpdated`, now);
        if (d.title)       writeDB(`videos/${vid}/videoTitle`,  d.title);
        if (d.authorName)  writeDB(`videos/${vid}/videoAuthor`, d.authorName);
      } else {
        _failed.add(vid); // null response — don't retry this session
      }
    } catch (_e) {
      // Cloud Function error — don't permanently mark failed so next load retries
    } finally {
      _pending.delete(vid);
    }
  }, delay);
}
