# NOVA Thumbnail Proxy

Vercel Hobby serverless function — no billing, no credit card.

## Deploy

1. Vercel account erstellen: https://vercel.com (GitHub-Login)
2. "Add New Project" → dieses GitHub-Repo importieren
3. **Root Directory** auf `vercel-proxy` setzen (wichtig!)
4. Deploy klicken
5. Vercel-URL notieren (z.B. `https://nova-thumbnail-proxy.vercel.app`)
6. URL in `js/features/thumbnails.js` bei `VERCEL_PROXY_URL` eintragen

## Test

```
curl "https://DEINE-URL.vercel.app/api/thumbnail?url=https://www.tiktok.com/@tiktok/video/6829267836783971589"
```

Erwartetes Ergebnis: JPEG-Bilddaten (kein JSON-Fehler).
