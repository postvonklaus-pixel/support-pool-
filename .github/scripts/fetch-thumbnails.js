const admin = require('firebase-admin');
const fetch = require('node-fetch');
const { execSync } = require('child_process');

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  databaseURL: 'https://support-pool-default-rtdb.asia-southeast1.firebasedatabase.app'
});

const db = admin.database();

const THUMB_CACHE_MS = 20 * 60 * 60 * 1000; // 20h cache

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function fetchViaYtdlp(url) {
  try {
    const out = execSync(
      `yt-dlp --dump-json --no-download --no-warnings --socket-timeout 20 -- "${url}"`,
      { timeout: 35000, encoding: 'utf8' }
    );
    const lines = out.trim().split('\n').filter(Boolean);
    const info = JSON.parse(lines[lines.length - 1]);
    const thumb = info.thumbnail ||
      (Array.isArray(info.thumbnails) && info.thumbnails.length > 0
        ? info.thumbnails[info.thumbnails.length - 1].url
        : null);
    if (thumb) {
      console.log('  [ytdlp] thumbnail:', thumb.slice(0, 80));
      return {
        thumbnail:   thumb,
        videoTitle:  info.title || '',
        videoAuthor: info.uploader || info.channel || '',
      };
    }
    console.log('  [ytdlp] no thumbnail in dump');
  } catch (e) {
    console.log('  [ytdlp] error:', e.message.slice(0, 200));
  }
  return null;
}

async function fetchOne(url) {
  if (!url.includes('tiktok.com')) throw new Error('Not a TikTok URL');

  // Strategy 1: yt-dlp
  const ytResult = fetchViaYtdlp(url);
  if (ytResult) return ytResult;

  // Strategy 2: TikTok oEmbed API
  try {
    const oRes = await fetch(
      'https://www.tiktok.com/oembed?url=' + encodeURIComponent(url),
      { timeout: 15000, headers: { 'User-Agent': BROWSER_UA, 'Accept': 'application/json' } }
    );
    const oText = await oRes.text();
    if (oRes.ok) {
      let od = {};
      try { od = JSON.parse(oText); } catch (e) {
        console.log('  [oembed] 200 non-JSON:', oText.slice(0, 120));
      }
      if (od.thumbnail_url) {
        console.log('  [oembed] thumbnail_url:', od.thumbnail_url.slice(0, 80));
        return { thumbnail: od.thumbnail_url, videoTitle: od.title || '', videoAuthor: od.author_name || '' };
      }
      console.log('  [oembed] 200 no thumbnail_url, keys:', Object.keys(od).join(','));
    } else {
      console.log('  [oembed] status:', oRes.status, oText.slice(0, 80));
    }
  } catch (e) {
    console.log('  [oembed] error:', e.message);
  }

  // Strategy 3: tikwm.com API (POST)
  let apiRes = await fetch('https://www.tikwm.com/api/', {
    method: 'POST', timeout: 20000,
    headers: {
      'User-Agent': BROWSER_UA,
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Referer': 'https://www.tikwm.com/', 'Origin': 'https://www.tikwm.com',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: 'url=' + encodeURIComponent(url) + '&count=12&cursor=0&web=1&hd=1',
  });
  if (!apiRes.ok) {
    apiRes = await fetch('https://www.tikwm.com/api/?url=' + encodeURIComponent(url), {
      timeout: 20000,
      headers: { 'User-Agent': BROWSER_UA, 'Accept': 'application/json', 'Referer': 'https://www.tikwm.com/' },
    });
  }
  if (!apiRes.ok) throw new Error('API fetch ' + apiRes.status);
  let data;
  try { data = await apiRes.json(); } catch (e) { throw new Error('API non-JSON'); }
  if (data.code !== 0 || !data.data) throw new Error('API error: ' + (data.msg || JSON.stringify(data)));
  const coverPath = data.data.cover;
  if (!coverPath) throw new Error('No cover in API response');
  const absoluteUrl = coverPath.startsWith('/') ? 'https://www.tikwm.com' + coverPath : coverPath;
  // Proxy through wsrv.nl to bypass tikwm.com hotlink protection in the browser
  const proxiedUrl = 'https://wsrv.nl/?url=' + encodeURIComponent(absoluteUrl) + '&output=webp&w=320';
  return { thumbnail: proxiedUrl, videoTitle: data.data.title || '', videoAuthor: data.data.author?.nickname || '' };
}

async function main() {
  const retryFailed  = process.env.RETRY === '1';
  const forceRefresh = process.env.FORCE === '1';
  console.log('Fetching thumbnails' + (retryFailed ? ' (retry)' : '') + (forceRefresh ? ' (force)' : '') + '...');
  const snap = await db.ref('sp6/videos').once('value');
  const videos = snap.val() || {};
  const now = Date.now();
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
  if (Object.keys(updates).length > 0) await db.ref('sp6/videos').update(updates);
  console.log(`Done: ${fetched} fetched, ${failed} failed, ${skipped} skipped`);
  await admin.app().delete();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
