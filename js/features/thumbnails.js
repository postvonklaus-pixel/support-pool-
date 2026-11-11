// VERCEL_PROXY_URL: set after deploying vercel-proxy/ to Vercel Hobby (free).
// Leave empty to disable thumbnail fetching entirely.
// Deploy instructions: vercel-proxy/README.md
const VERCEL_PROXY_URL = '';

const _pending = new Set();
const _failed  = new Set();
const CACHE_MS = 20 * 60 * 60 * 1000; // 20h

export async function fetchMissingThumbnail(vid, videoUrl, currentThumb, thumbnailUpdated) {
  if (!VERCEL_PROXY_URL) return;
  if (!vid || !videoUrl) return;
  if (!videoUrl.includes('tiktok.com')) return;
  if (_pending.has(vid) || _failed.has(vid)) return;
  if (currentThumb && thumbnailUpdated > Date.now() - CACHE_MS) return;

  _pending.add(vid);

  // Stagger requests: 300 ms per video to avoid rate-limiting the proxy
  const delay = (_pending.size - 1) * 300;
  setTimeout(async () => {
    try {
      // 1. Fetch image bytes via Vercel proxy (oEmbed + download, server-side)
      const res = await fetch(
        VERCEL_PROXY_URL + '?url=' + encodeURIComponent(videoUrl),
        { signal: AbortSignal.timeout(15000) }
      );
      if (!res.ok) { _failed.add(vid); return; }

      const blob       = await res.blob();
      const authorName = res.headers.get('x-author-name') || '';
      const videoTitle = res.headers.get('x-video-title')  || '';

      if (!blob || blob.size < 100) { _failed.add(vid); return; }

      // 2. Upload to Firebase Storage (permanent URL, not TikTok CDN)
      let storageUrl = null;
      try {
        const storageRef = firebase.storage().ref('thumbnails/' + vid + '.jpg');
        await storageRef.put(blob, { contentType: blob.type || 'image/jpeg' });
        storageUrl = await storageRef.getDownloadURL();
      } catch (storageErr) {
        console.warn('[thumbnails] storage upload failed:', storageErr.message);
        _failed.add(vid);
        return;
      }

      const now = Date.now();

      // 3. Update local state
      try {
        const { state } = await import('../state.js');
        if (state.db.videos?.[vid]) {
          state.db.videos[vid].thumbnail        = storageUrl;
          state.db.videos[vid].thumbnailUpdated = now;
          if (videoTitle)  state.db.videos[vid].videoTitle  = videoTitle;
          if (authorName)  state.db.videos[vid].videoAuthor = authorName;
        }
      } catch (_) {}

      // 4. Update DOM in-place (no re-render needed)
      try {
        const escaped = CSS.escape(String(vid));
        document.querySelectorAll('[data-vid="' + escaped + '"]').forEach(wrap => {
          const img = wrap.querySelector('.vc-thumb');
          if (img) {
            img.src = storageUrl;
          } else {
            const fb = wrap.querySelector('.vc-thumb-fallback');
            if (fb) {
              const el = document.createElement('img');
              el.className      = 'vc-thumb';
              el.src            = storageUrl;
              el.alt            = '';
              el.loading        = 'lazy';
              el.referrerPolicy = 'no-referrer';
              el.onerror        = function () {
                this.outerHTML = '<div class="vc-thumb-fallback"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>';
              };
              fb.replaceWith(el);
            }
          }
        });
      } catch (_) {}

      // 5. Persist to Firebase RTDB
      const { writeDB } = await import('../firebase.js');
      writeDB('videos/' + vid + '/thumbnail',        storageUrl);
      writeDB('videos/' + vid + '/thumbnailUpdated', now);
      if (videoTitle)  writeDB('videos/' + vid + '/videoTitle',  videoTitle);
      if (authorName)  writeDB('videos/' + vid + '/videoAuthor', authorName);

    } catch (_e) {
      // Timeout or network error — retry next session, don't mark as permanently failed
    } finally {
      _pending.delete(vid);
    }
  }, delay);
}
