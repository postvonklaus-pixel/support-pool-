/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Firebase Messaging Service Worker
   Receives FCM push notifications while app is in
   background or closed. Scope: / (domain root)
   ═══════════════════════════════════════════════════════ */

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyAwtRKoqHRpdwjXbtTUmUAuadgJIgkyleQ',
  authDomain:        'support-pool.firebaseapp.com',
  databaseURL:       'https://support-pool-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId:         'support-pool',
  storageBucket:     'support-pool.firebasestorage.app',
  messagingSenderId: '620989491854',
  appId:             '1:620989491854:web:ab99c2cb7864e63a98f7df',
});

const messaging = firebase.messaging();

// Called when app is backgrounded or closed
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  const data = payload.data || {};
  self.registration.showNotification(title || 'NOVA Support Pool', {
    body:  body || '',
    icon:  icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data,
    tag:   data.tag || 'nova-push',
  });
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
      const existing = cs.find(c => c.url.includes('autosocial.cc'));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});
