/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Service Worker v4
   Network-first for HTML + JS; cache-first for CSS/images.
   Bump CACHE version here to bust all old caches.
   ═══════════════════════════════════════════════════════ */

const CACHE = 'nova-v4';

// Pre-cache only truly static assets (CSS). JS is always network-first.
const STATIC_CSS = [
  '/support-pool-/css/tokens.css',
  '/support-pool-/css/base.css',
  '/support-pool-/css/components.css',
  '/support-pool-/css/layout.css',
  '/support-pool-/css/screens/login.css',
  '/support-pool-/css/screens/dashboard.css',
  '/support-pool-/css/screens/home.css',
  '/support-pool-/css/screens/profile.css',
  '/support-pool-/css/screens/admin.css',
  '/support-pool-/css/screens/settings.css',
  '/support-pool-/css/screens/myvideos.css',
  '/support-pool-/css/screens/caption.css',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(STATIC_CSS.map(url => c.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Skip non-GET and cross-origin (Firebase, fonts, CDN)
  if (e.request.method !== 'GET') return;
  if (!url.origin.includes('github.io') && !url.origin.includes('localhost')) return;

  // HTML and JS: always network-first so fixes deploy immediately
  if (
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js')
  ) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // CSS and other static assets: stale-while-revalidate
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fresh = fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      });
      return cached || fresh;
    })
  );
});

self.addEventListener('push', e => {
  if (!e.data) return;
  const data = e.data.json();
  e.waitUntil(
    self.registration.showNotification(data.title || 'NOVA Support Pool', {
      body: data.body || '',
      icon: '/support-pool-/icons/icon-192.png',
      tag: data.tag || 'nova',
      data,
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/support-pool-/'));
});
