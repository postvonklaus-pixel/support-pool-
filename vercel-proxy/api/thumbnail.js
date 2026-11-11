// NOVA Support Pool — TikTok Thumbnail Proxy
// Deployed on Vercel Hobby (free, no credit card).
// Receives a TikTok video URL, calls TikTok oEmbed server-side,
// returns JSON with thumbnail_url + metadata (no image download needed).
// Client stores the CDN URL directly in Firebase RTDB.

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'missing url parameter' });

  try {
    // Resolve shortened URLs (vm.tiktok.com, vt.tiktok.com) to full URLs first,
    // because TikTok oembed returns no metadata for shortened links.
    let resolvedUrl = url;
    if (/vm\.tiktok\.com|vt\.tiktok\.com/.test(url)) {
      try {
        const redir = await fetch(url, {
          method: 'GET', redirect: 'follow',
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ThumbnailBot/1.0)' },
          signal: AbortSignal.timeout(8000),
        });
        resolvedUrl = redir.url || url;
      } catch (_) {}
    }

    const oembedRes = await fetch(
      'https://www.tiktok.com/oembed?url=' + encodeURIComponent(resolvedUrl),
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ThumbnailBot/1.0)' } }
    );
    if (!oembedRes.ok) {
      return res.status(502).json({ error: 'oembed_' + oembedRes.status });
    }

    const data = await oembedRes.json();
    // Some TikTok responses use different field names — check all variants
    const thumbUrl = data.thumbnail_url || data.thumbnail || null;
    if (!thumbUrl) {
      return res.status(404).json({ error: 'no_thumbnail', oembed_fields: Object.keys(data) });
    }

    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json({
      thumbnail_url: thumbUrl,
      author_name:   data.author_name || '',
      title:         data.title       || '',
    });

  } catch (err) {
    console.error('[thumbnail-proxy]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
