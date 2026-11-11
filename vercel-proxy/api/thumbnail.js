// NOVA Support Pool — TikTok Thumbnail Proxy
// Deployed on Vercel Hobby (free, no credit card).
// Receives a TikTok video URL, calls TikTok oEmbed server-side,
// downloads the thumbnail image and returns it with CORS headers.
// The client then uploads the image to Firebase Storage for permanent hosting.

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'missing url parameter' });

  try {
    // 1. TikTok oEmbed (server-side — no CORS restriction)
    const oembedRes = await fetch(
      'https://www.tiktok.com/oembed?url=' + encodeURIComponent(url),
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ThumbnailBot/1.0)' } }
    );
    if (!oembedRes.ok) {
      return res.status(502).json({ error: 'oembed_' + oembedRes.status });
    }

    const data = await oembedRes.json();
    if (!data.thumbnail_url) {
      return res.status(404).json({ error: 'no_thumbnail' });
    }

    // 2. Download thumbnail image
    const imgRes = await fetch(data.thumbnail_url);
    if (!imgRes.ok) {
      return res.status(502).json({ error: 'img_download_' + imgRes.status });
    }

    const buffer      = await imgRes.arrayBuffer();
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';

    // 3. Return image bytes + metadata headers
    res.setHeader('Content-Type',     contentType);
    res.setHeader('Cache-Control',    'public, max-age=86400');
    res.setHeader('X-Author-Name',    data.author_name || '');
    res.setHeader('X-Video-Title',    data.title       || '');
    return res.status(200).send(Buffer.from(buffer));

  } catch (err) {
    console.error('[thumbnail-proxy]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
