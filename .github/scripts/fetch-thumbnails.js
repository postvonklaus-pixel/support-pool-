const admin = require('firebase-admin');
const fetch = require('node-fetch');

admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  ),
  databaseURL: 'https://support-pool-default-rtdb.asia-southeast1.firebasedatabase.app'
});

const db = admin.database();
const THUMB_CACHE_MS = 7 * 24 * 60 * 60 * 1000;

const BROWSER_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

async function fetchOne(url) {
  if (!url.includes('tiktok.com')) throw new Error('Not a TikTok URL');

  // tikwm.com public API — reliably returns cover, title, author for TikTok URLs
  const apiUrl = 'https://www.tikwm.com/api/?url=' + encodeURIComponent(url);
  const apiRes = await fetch(apiUrl, {
    timeout: 20000,
    headers: { 'User-Agent': BROWSER_UA, 'Accept': 'application/json' }
  });
  if (!apiRes.ok) throw new Error('API fetch ' + apiRes.status);

  let data;
  try { data = await apiRes.json(); } catch (e) { throw new Error('API non-JSON'); }

  if (data.code !== 0 || !data.data) throw new Error('API error: ' + (data.msg || JSON.stringify(data)));

  const coverUrl = data.data.cover || data.data.origin_cover;
  if (!coverUrl) throw new Error('No cover URL in API response');

  const thumbRes = await fetch(coverUrl, {
    timeout: 15000,
    headers: { 'User-Agent': BROWSER_UA }
  });
  if (!thumbRes.ok) throw new Error('Thumb fetch ' + thumbRes.status);

  const buffer = await thumbRes.buffer();
  if (buffer.length > 200 * 1024) throw new Error('Thumbnail too large: ' + buffer.length + ' bytes');

  const mime = coverUrl.includes('.webp') ? 'image/webp' : 'image/jpeg';
  return {
    thumbnail:   `data:${mime};base64,` + buffer.toString('base64'),
    videoTitle:  data.data.title || '',
    videoAuthor: data.data.author?.nickname || ''
  };
}

async function main() {
  // RETRY=1 env var skips the 24h failure cooldown (use after fixing a bug)
  const retryFailed = process.env.RETRY === '1';
  console.log('Fetching thumbnails' + (retryFailed ? ' (retry mode)' : '') + '...');
  const snap   = await db.ref('sp6/videos').once('value');
  const videos = snap.val() || {};
  const now    = Date.now();
  const updates = {};
  let fetched = 0, failed = 0, skipped = 0;

  for (const [vid, video] of Object.entries(videos)) {
    if (video.status !== 'open' && video.status !== 'done') { skipped++; continue; }
    if (video.thumbnail && video.thumbnailUpdated > now - THUMB_CACHE_MS) { skipped++; continue; }
    if (!retryFailed && video.thumbnailFailed && video.thumbnailFailedAt > now - 86400000) { skipped++; continue; }
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
      console.log('OK:', vid, '->', data.videoAuthor);
      await new Promise(r => setTimeout(r, 1000));
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

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
