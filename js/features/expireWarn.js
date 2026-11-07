/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Ticket 6: 24h Expire Warning
   Checks current user's videos and fires a one-time
   notification when expiry + balance-gate would collide.
   ═══════════════════════════════════════════════════════ */

import { state }   from '../state.js';
import { writeDB } from '../firebase.js';
import { addNotif } from './notifications.js';
import { getNextFridayWIB } from '../utils.js';

const WARN_MS  = 24 * 60 * 60 * 1000; // 24 hours in ms
const BAL_LOCK = 3;

function _enabled() {
  return state.db?.settings?.features?.expireWarn24h !== false;
}

// Mirrors _checkWeeklyCleanup() expiry logic from posting.js:
// a video expires at max(nextFriday, postedAt + 24h)
function _computeExpiresAt(v) {
  const nextFriday = getNextFridayWIB();
  const posted     = v.postedAt || v.ts || 0;
  return Math.max(nextFriday, posted + WARN_MS);
}

function _wouldBeLocked(cu) {
  const u = state.db.members?.[cu];
  if (!u) return false;
  const given = u.stats?.given    || 0;
  const recv  = u.stats?.received || 0;
  return (given - recv) >= BAL_LOCK;
}

export function checkExpireWarnings() {
  if (!_enabled()) return;
  const cu = state.currentUser;
  if (!cu) return;

  const now   = Date.now();
  const myKey = cu.toLowerCase();

  Object.entries(state.db.videos || {}).forEach(([vidId, v]) => {
    // Active videos only
    if (v.status === 'done' || v.status === 'expired' || v.status === 'scheduled') return;
    // Only current user's videos
    if ((v.ownerKey || v.owner || '').toLowerCase() !== myKey) return;
    // Fire exactly once per video
    if (v.warned24h) return;

    const expiresAt = _computeExpiresAt(v);
    const timeLeft  = expiresAt - now;
    // Not in the 24h warning window (or already past)
    if (timeLeft >= WARN_MS || timeLeft <= 0) return;

    // Balance gate would apply after this video expires
    if (!_wouldBeLocked(cu)) return;

    // Set flag on video (prevents re-firing)
    writeDB(`videos/${vidId}/warned24h`, true);

    // Add personal notification (skipUnread=true: excluded from unread badge)
    const hLeft = Math.max(1, Math.ceil(timeLeft / 3600000));
    addNotif(cu, '⚠️', null, 'expireWarn24h', {
      msgKey:    'notifExpireWarn24h',
      params:    { h: hLeft },
      vidId,
      skipUnread: true,
    });
    // Ticket 10: FCM push
    import('./fcm.js').then(({ sendPush }) => {
      sendPush(cu, { title: `⚠️ Dein Video läuft in ${hLeft}h ab!`, tag: 'expire-warn' });
    });
  });
}
