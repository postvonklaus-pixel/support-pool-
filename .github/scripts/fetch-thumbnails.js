const admin = require('firebase-admin');
const fetch = require('node-fetch');

admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  ),
  databaseURL: 'https://support-pool-default-rtdb.asia-southeast1.firebasedatabase.app'
});

const db = admin.database();

// Refresh every 20h so CDN URLs never expire (TikTok URLs last ~24h)
const THUMB_CACHE_MS = 20 * 60 * 60 * 1000;

const BROWSER_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

async function fetchOne(url) {
  if (!url.includes('tiktok.com')) throw new Error('Not a TikTok URL');

  // tikwm.com public API — try POST first (less likely to be IP-blocked than GET)
  let apiRes = await fetch('https://www.tikwm.com/api/', {
    method: 'POST',
    timeout: 20000,
    headers: {
      'User-Agent': BROWSER_UA,
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Referer': 'https://www.tikwm.com/',
      'Origin': 'https://www.tikwm.com',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: 'url=' + encodeURIComponent(url) + '&count=12&cursor=0&web=1&hd=1',
  });
  // Fallback to GET if POST is also blocked
  if (!apiRes.ok) {
    apiRes = await fetch('https://www.tikwm.com/api/?url=' + encodeURIComponent(url), {
      timeout: 20000,
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'application/json',
        'Referer': 'https://www.tikwm.com/',
        'Origin': 'https://www.tikwm.com',
      },
    });
  }
  if (!apiRes.ok) throw new Error('API fetch ' + apiRes.status);

  let data;
  try { data = await apiRes.json(); } catch (e) { throw new Error('API non-JSON'); }

  if (data.code !== 0 || !data.data) throw new Error('API error: ' + (data.msg || JSON.stringify(data)));

  // Store the CDN URL directly — far smaller than base64 in Firebase RTDB.
  // The workflow runs every 30 min so the URL is always refreshed before it expires.
  const coverUrl = data.data.cover || data.data.origin_cover;
  if (!coverUrl) throw new Error('No cover URL in API response');

  return {
    thumbnail:   coverUrl,
    videoTitle:  data.data.title || '',
    videoAuthor: data.data.author?.nickname || ''
  };
}

async function main() {
  // RETRY=1 env var skips the cache check (use after fixing a bug)
  const retryFailed = process.env.RETRY === '1';
  const forceRefresh = process.env.FORCE === '1';
  console.log('Fetching thumbnails' + (retryFailed ? ' (retry mode)' : '') + (forceRefresh ? ' (force refresh)' : '') + '...');
  const snap   = await db.ref('sp6/videos').once('value');
  const videos = snap.val() || {};
  const now    = Date.now();
  const updates = {};
  let fetched = 0, failed = 0, skipped = 0;

  for (const [vid, video] of Object.entries(videos)) {
    if (video.status !== 'open' && video.status !== 'done') { skipped++; continue; }
    // Skip only if thumbnail is a fresh CDN URL (not a stale base64 or old URL)
    const isBase64 = typeof video.thumbnail === 'string' && video.thumbnail.startsWith('data:');
    if (!forceRefresh && !isBase64 && video.thumbnail && video.thumbnailUpdated > now - THUMB_CACHE_MS) { skipped++; continue; }
    if (!forceRefresh && !retryFailed && video.thumbnailFailed && video.thumbnailFailedAt > now - 86400000) { skipped++; continue; }
    const videoUrl = video.link || video.url;
    if (!videoUrl) { skipped++; continue; }

    try {
      const data = await fetchOne(videoUrl);
      updates[vid + '/thumbnail']         = data.thumbnail;
      updates[vid + '/thumbnailUpdated']  = now;
      updates[vid + '/videoTitle']        = data.videoTitle;
      updates[vid + '/videoAuthor']       = data.videoAuthor;
      updates[vid + '/thumbnailFailed']   = null;
      updates[vid + '/thumbnailFailedAt'] = null;
      fetched++;
      console.log('OK:', vid, '->', data.videoAuthor, coverUrlShort(data.thumbnail));
      await new Promise(r => setTimeout(r, 800));
    } catch (err) {
      updates[vid + '/thumbnailFailed']   = err.message;
      updates[vid + '/thumbnailFailedAt'] = now;
      failed++;
      console.log('FAIL:', vid, '->', err.message);
    }
  }

  if (Object.keys(updates).length > 0) {
    await db.ref('sp6/videos').update(updates);
  }

  console.log(`Done: ${fetched} fetched, ${failed} failed, ${skipped} skipped`);
  await admin.app().delete();
}

function coverUrlShort(url) {
  if (!url) return '';
  return url.length > 60 ? url.slice(0, 60) + '...' : url;
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
