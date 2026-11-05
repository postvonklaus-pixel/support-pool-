const admin = require('firebase-admin');
const fetch = require('node-fetch');
const sharp = require('sharp');

admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  ),
  databaseURL: 'https://support-pool-default-rtdb.asia-southeast1.firebasedatabase.app'
});

const db = admin.database();

// Cache 20h — workflow runs every 30 min so thumbnails are always fresh
const THUMB_CACHE_MS = 20 * 60 * 60 * 1000;

const BROWSER_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

async function fetchOne(url) {
  if (!url.includes('tiktok.com')) throw new Error('Not a TikTok URL');

  // Step 1: get video metadata from tikwm.com API
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

  const coverPath = data.data.cover;
  if (!coverPath) throw new Error('No cover in API response');
  const imageUrl = coverPath.startsWith('/') ? 'https://www.tikwm.com' + coverPath : coverPath;

  // Step 2: download the image (GH runner can reach tikwm.com)
  const imgRes = await fetch(imageUrl, {
    timeout: 15000,
    headers: {
      'User-Agent': BROWSER_UA,
      'Referer': 'https://www.tikwm.com/',
      'Accept': 'image/webp,image/*,*/*',
    },
  });
  if (!imgRes.ok) throw new Error('Image download ' + imgRes.status);
  const imgBuf = Buffer.from(await imgRes.arrayBuffer());

  // Step 3: resize to 120px wide (keeps aspect ratio), encode as small WebP
  const resized = await sharp(imgBuf)
    .resize(120, null, { withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer();

  const base64 = 'data:image/webp;base64,' + resized.toString('base64');
  console.log('  image size:', imgBuf.length, 'bytes ->', resized.length, 'bytes');

  return {
    thumbnail:   base64,
    videoTitle:  data.data.title || '',
    videoAuthor: data.data.author?.nickname || '',
  };
}

async function main() {
  const retryFailed  = process.env.RETRY === '1';
  const forceRefresh = process.env.FORCE === '1';
  console.log('Fetching thumbnails' + (retryFailed ? ' (retry)' : '') + (forceRefresh ? ' (force)' : '') + '...');

  const snap   = await db.ref('sp6/videos').once('value');
  const videos = snap.val() || {};
  const now    = Date.now();
  const updates = {};
  let fetched = 0, failed = 0, skipped = 0;

  for (const [vid, video] of Object.entries(videos)) {
    if (video.status !== 'open' && video.status !== 'done') { skipped++; continue; }
    const isBase64 = typeof video.thumbnail === 'string' && video.thumbnail.startsWith('data:');
    // Skip if we have a fresh small base64 thumbnail (< 20h old)
    if (!forceRefresh && isBase64 && video.thumbnailUpdated > now - THUMB_CACHE_MS) { skipped++; continue; }
    // Skip non-base64 thumbnails only if cache is fresh (CDN URLs from before the fix)
    if (!forceRefresh && !isBase64 && video.thumbnail && video.thumbnailUpdated > now - THUMB_CACHE_MS) { skipped++; continue; }
    if (!forceRefresh && !retryFailed && video.thumbnailFailed && video.thumbnailFailedAt > now - 86400000) { skipped++; continue; }
    const videoUrl = video.link || video.url;
    if (!videoUrl) { skipped++; continue; }

    try {
      const result = await fetchOne(videoUrl);
      updates[vid + '/thumbnail']         = result.thumbnail;
      updates[vid + '/thumbnailUpdated']  = now;
      updates[vid + '/videoTitle']        = result.videoTitle;
      updates[vid + '/videoAuthor']       = result.videoAuthor;
      updates[vid + '/thumbnailFailed']   = null;
      updates[vid + '/thumbnailFailedAt'] = null;
      fetched++;
      console.log('OK:', vid, '->', result.videoAuthor, '(' + Math.round(result.thumbnail.length / 1024) + 'KB)');
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

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
