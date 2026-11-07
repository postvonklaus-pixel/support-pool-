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

    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = firebase.messaging();
    const token = await messaging.getToken({ vapidKey, serviceWorkerRegistration: reg });
    if (token) {
      const cu = state.currentUser;
      if (cu) writeDB(`members/${cu}/fcmToken`, token);
      _ready = true;
    }
    messaging.onMessage(() => {}); // foreground: in-app notif already shown
  } catch (e) {
    console.warn('[FCM] init failed:', e.message);
  }
}

// Send push to any pool member. Silent no-op if they have no FCM token.
export async function sendPush(recipientKey, { title, body = '', tag = 'nova-push', url = '/support-pool-/' } = {}) {
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
