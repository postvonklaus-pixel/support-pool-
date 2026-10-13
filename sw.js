/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Service Worker
   Cache-first for static assets, network-first for data
   ═══════════════════════════════════════════════════════ */

const CACHE = 'nova-v2';
const STATIC = [
  '/support-pool-/',
  '/support-pool-/index.html',
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
  '/support-pool-/manifest.json',
  '/support-pool-/icons/icon-192.png',
  '/support-pool-/icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Skip non-GET and Firebase requests
  if (e.request.method !== 'GET') return;
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const fresh = fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => cached);
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
      badge: '/support-pool-/icons/favicon-32x32.png',
      tag: data.tag || 'nova',
      data: data,
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/support-pool-/'));
});
