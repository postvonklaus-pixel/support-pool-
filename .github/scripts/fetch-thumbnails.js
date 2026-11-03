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

async function fetchOne(url) {
  const oembedUrl = 'https://www.tiktok.com/oembed?url=' + encodeURIComponent(url);
  const res = await fetch(oembedUrl, { timeout: 12000 });
  if (!res.ok) throw new Error('oEmbed ' + res.status);
  const data = await res.json();
  if (!data.thumbnail_url) throw new Error('No thumbnail');

  const thumbRes = await fetch(data.thumbnail_url, { timeout: 12000 });
  if (!thumbRes.ok) throw new Error('Thumb fetch ' + thumbRes.status);

  const buffer = await thumbRes.buffer();
  if (buffer.length > 100 * 1024) {
    throw new Error('Thumbnail too large: ' + buffer.length);
  }

  return {
    thumbnail:   'data:image/jpeg;base64,' + buffer.toString('base64'),
    videoTitle:  data.title || '',
    videoAuthor: data.author_name || ''
  };
}

async function main() {
  console.log('Fetching thumbnails...');
  const snap   = await db.ref('sp6/videos').once('value');
  const videos = snap.val() || {};
  const now    = Date.now();
  const updates = {};
  let fetched = 0, failed = 0, skipped = 0;

  for (const [vid, video] of Object.entries(videos)) {
    if (video.status !== 'open' && video.status !== 'done') { skipped++; continue; }
    if (video.thumbnail && video.thumbnailUpdated > now - THUMB_CACHE_MS) { skipped++; continue; }
    if (video.thumbnailFailed && video.thumbnailFailedAt > now - 86400000) { skipped++; continue; }
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
