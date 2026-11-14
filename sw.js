/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Service Worker v5
   Network-first for HTML + JS; cache-first for CSS.
   Responds to SKIP_WAITING message from the page.
   ═══════════════════════════════════════════════════════ */

const CACHE = 'nova-v79';

const STATIC_CSS = [
  '/css/tokens.css',
  '/css/base.css',
  '/css/components.css',
  '/css/layout.css',
  '/css/screens/login.css',
  '/css/screens/dashboard.css',
  '/css/screens/home.css',
  '/css/screens/profile.css',
  '/css/screens/admin.css',
  '/css/screens/settings.css',
  '/css/screens/myvideos.css',
  '/css/screens/caption.css',
  '/css/screens/chat.css',
  '/css/components/video-preview.css',
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

// Page sends SKIP_WAITING when it detects a waiting SW (iOS Safari workaround)
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  if (e.request.method !== 'GET') return;
  if (!url.origin.includes('github.io') && !url.origin.includes('localhost')) return;

  // HTML + JS + CSS: network-first so every push reaches users immediately
  if (
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css')
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

  // Other assets: stale-while-revalidate
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
      icon: '/icons/icon-192.png',
      tag: data.tag || 'nova',
      data,
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/'));
});
