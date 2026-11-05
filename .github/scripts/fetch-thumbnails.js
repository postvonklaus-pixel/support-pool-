const admin = require('firebase-admin');
const fetch = require('node-fetch');

admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  ),
  databaseURL: 'https://support-pool-default-rtdb.asia-southeast1.firebasedatabase.app'
});

const db = admin.database();

// Cache 20h — workflow runs every 30 min; TikTok CDN URLs expire ~24h
const THUMB_CACHE_MS = 20 * 60 * 60 * 1000;

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchOne(url) {
  if (!url.includes('tiktok.com')) throw new Error('Not a TikTok URL');

  // ── Strategy 1: TikTok official oEmbed API ─────────────────────────────
  // Returns thumbnail_url — a direct TikTok CDN URL publicly loadable by browsers.
  try {
    const oRes = await fetch(
      'https://www.tiktok.com/oembed?url=' + encodeURIComponent(url),
      {
        timeout: 15000,
        headers: { 'User-Agent': BROWSER_UA, 'Accept': 'application/json' },
      }
    );
    if (oRes.ok) {
      const od = await oRes.json();
      if (od.thumbnail_url) {
        console.log('  [oembed] thumbnail_url:', od.thumbnail_url.slice(0, 80));
        return {
          thumbnail:   od.thumbnail_url,
          videoTitle:  od.title || '',
          videoAuthor: od.author_name || '',
        };
      }
    } else {
      console.log('  [oembed] status:', oRes.status);
    }
  } catch (e) {
    console.log('  [oembed] error:', e.message);
  }

  // ── Strategy 2: tikwm.com API (POST) ───────────────────────────────────
  // Cover URL is relative (/video/cover/xxx.webp) — served by tikwm.com CDN.
  // Store it and let the app load with referrerpolicy=no-referrer.
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
      },
    });
  }
  if (!apiRes.ok) throw new Error('API fetch ' + apiRes.status);

  let data;
  try { data = await apiRes.json(); } catch (e) { throw new Error('API non-JSON'); }
  if (data.code !== 0 || !data.data) throw new Error('API error: ' + (data.msg || JSON.stringify(data)));

  const coverPath = data.data.cover;
  if (!coverPath) throw new Error('No cover in API response');
  const absoluteUrl = coverPath.startsWith('/') ? 'https://www.tikwm.com' + coverPath : coverPath;

  return {
    thumbnail:   absoluteUrl,
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
    if (!forceRefresh && video.thumbnail && video.thumbnailUpdated > now - THUMB_CACHE_MS) { skipped++; continue; }
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
      const short = result.thumbnail.length > 80 ? result.thumbnail.slice(0, 80) + '...' : result.thumbnail;
      console.log('OK:', vid, '->', result.videoAuthor, '|', short);
      await new Promise(r => setTimeout(r, 600));
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
