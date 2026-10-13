/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Service Worker v3
   Network-first for HTML; cache-first for static assets.
   Bump CACHE version here to bust all old caches.
   ═══════════════════════════════════════════════════════ */

const CACHE = 'nova-v3';

// Only cache files we KNOW exist. Icons are excluded until they're added.
const STATIC = [
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
  '/support-pool-/js/main.js',
  '/support-pool-/js/utils.js',
  '/support-pool-/js/state.js',
  '/support-pool-/js/storage.js',
  '/support-pool-/js/firebase.js',
  '/support-pool-/js/i18n.js',
  '/support-pool-/js/router.js',
  '/support-pool-/js/events.js',
];

self.addEventListener('install', e => {
  // Cache static assets; skip waiting so the new SW activates immediately.
  // Use individual catch so one missing file doesn't abort the whole install.
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(STATIC.map(url => c.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  // Delete all old caches
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Skip non-GET and third-party requests (Firebase, fonts, CDN)
  if (e.request.method !== 'GET') return;
  if (!url.origin.includes('github.io') && !url.origin.includes('localhost')) return;
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis')) return;

  // HTML: always network-first so the app always boots fresh
  if (url.pathname.endsWith('/') || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(e.request)
        .then(res => { caches.open(CACHE).then(c => c.put(e.request, res.clone())); return res; })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Static assets: cache-first, update cache in background
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

// Push notifications
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
