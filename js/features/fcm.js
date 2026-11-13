/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — FCM Web Push (Ticket 10)

   Setup:
     1. Firebase Console → Project Settings → Cloud Messaging
        → Web Push certificates → Generate key pair
     2. Copy the VAPID public key
     3. Set in RTDB: sp6/settings/fcmVapidKey = "<your key>"

   Feature flag: sp6/settings/features/fcmPush (default true)
   ═══════════════════════════════════════════════════════ */

import { state }  from '../state.js';
import { writeDB, callFn } from '../firebase.js';
import { getAllLangs } from '../i18n.js';

let _ready = false;

function _enabled() {
  return state.db?.settings?.features?.fcmPush !== false;
}

// Returns translated text in a specific member's language (for cross-user pushes)
function _tFor(recipientKey, key, params = {}) {
  const lang  = state.db.members?.[recipientKey]?.lang || 'de';
  const langs = getAllLangs();
  let text = langs[lang]?.[key] || langs.de?.[key] || '';
  Object.entries(params).forEach(([k, v]) => { text = text.replace(`{${k}}`, v); });
  return text;
}

export async function initFcm() {
  if (_ready || !_enabled()) return;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
  if (typeof firebase === 'undefined' || typeof firebase.messaging !== 'function') return;

  const vapidKey = state.db?.settings?.fcmVapidKey;
  if (!vapidKey) {
    console.info('[FCM] vapidKey not set — push disabled. Set sp6/settings/fcmVapidKey in RTDB.');
    return;
  }

  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return;

    // Relative to document.baseURI so it works under any sub-path (e.g. /support-pool-/)
    const swUrl = new URL('firebase-messaging-sw.js', document.baseURI).href;
    const reg = await navigator.serviceWorker.register(swUrl);
    const messaging = firebase.messaging();
    const token = await messaging.getToken({ vapidKey, serviceWorkerRegistration: reg });
    if (token) {
      const cu = state.currentUser;
      if (cu) writeDB(`members/${cu}/fcmToken`, token);
      _ready = true;
    }
    // Foreground: app is open — show notification via SW so it looks identical
    // to background pushes (native OS notification, not an in-app toast).
    messaging.onMessage((payload) => {
      const { title, body, icon } = payload.notification || {};
      const data = payload.data || {};
      navigator.serviceWorker.ready.then(swReg => {
        swReg.showNotification(title || 'NOVA Support Pool', {
          body:  body  || '',
          icon:  icon  || '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          data,
          tag:   data.tag || 'nova-push',
        });
      }).catch(() => {}); // silently ignore if SW unavailable
    });
  } catch (e) {
    console.warn('[FCM] init failed:', e.message);
  }
}

// Send push to any pool member. Silent no-op if they have no FCM token.
export async function sendPush(recipientKey, { title, body = '', tag = 'nova-push', url = '/' } = {}) {
  if (!_enabled()) return;
  if (!recipientKey || !title) return;
  const token = state.db.members?.[recipientKey]?.fcmToken;
  if (!token) return;
  try {
    await callFn('sendFcmPush', { token, title, body, data: { tag, url } });
  } catch (e) {
    console.warn('[FCM] sendPush failed:', e.message);
  }
}

// Convenience: build push title for support-received notification
export function pushTitleSupportRcvd(ownerKey, senderName) {
  return _tFor(ownerKey, 'pushSupportRcvd', { from: senderName })
    || `💬 ${senderName} hat dein Video supportet! 🎉`;
}
