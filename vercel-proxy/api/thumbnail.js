// NOVA Support Pool — TikTok Thumbnail Proxy
// Deployed on Vercel Hobby (free, no credit card).
// Uses tikwm.com API (server-side) to bypass browser CORS restrictions.
// TikTok oembed no longer returns thumbnail_url — tikwm is the fallback.

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'missing url parameter' });

  try {
    // Resolve shortened URLs (vm.tiktok.com → www.tiktok.com/...)
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

    // Primary: tikwm.com API (reliable TikTok metadata source)
    const tikwmRes = await fetch(
      'https://www.tikwm.com/api/?url=' + encodeURIComponent(resolvedUrl),
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ThumbnailBot/1.0)' },
        signal: AbortSignal.timeout(12000),
      }
    );

    if (tikwmRes.ok) {
      const tikwmData = await tikwmRes.json();
      const cover = tikwmData?.data?.cover || tikwmData?.data?.origin_cover || null;
      if (tikwmData.code === 0 && cover) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.status(200).json({
          thumbnail_url: cover,
          author_name:   tikwmData.data.author?.nickname || tikwmData.data.author?.name || '',
          title:         tikwmData.data.title || '',
        });
      }
    }

    // Fallback: TikTok oembed (may not return thumbnail_url anymore)
    const oembedRes = await fetch(
      'https://www.tiktok.com/oembed?url=' + encodeURIComponent(resolvedUrl),
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ThumbnailBot/1.0)' } }
    );
    if (oembedRes.ok) {
      const data = await oembedRes.json();
      const thumbUrl = data.thumbnail_url || data.thumbnail || null;
      if (thumbUrl) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.status(200).json({
          thumbnail_url: thumbUrl,
          author_name:   data.author_name || '',
          title:         data.title       || '',
        });
      }
    }

    return res.status(404).json({ error: 'no_thumbnail' });

  } catch (err) {
    console.error('[thumbnail-proxy]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
