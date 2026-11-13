#!/usr/bin/env node
/**
 * Server-side queue processor for NOVA Support Pool.
 * Replicates checkScheduledVideos() + _checkWeeklyCleanup() from posting.js.
 * Run via GitHub Actions cron every 2 hours.
 *
 * Requires env var:
 *   FIREBASE_SERVICE_ACCOUNT — full JSON content of the service account key file
 */

'use strict';

const admin = require('firebase-admin');

const SA = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!SA.project_id) {
  console.error('Missing or invalid FIREBASE_SERVICE_ACCOUNT env var');
  process.exit(1);
}

admin.initializeApp({
  credential:   admin.credential.cert(SA),
  databaseURL:  'https://support-pool-default-rtdb.asia-southeast1.firebasedatabase.app',
});

const db   = admin.database();
const BASE = 'sp6';

const BAL_LIMIT = -10;

// ── WIB helpers (UTC+7, reset Friday 00:00 WIB) ──────────
function getLastFridayWIB() {
  const WIB_MS = 7 * 3600000;
  const nowWIB = Date.now() + WIB_MS;
  const d      = new Date(nowWIB);
  const dow    = d.getUTCDay();
  const daysSinceFri = (dow + 7 - 5) % 7;
  const midnight = nowWIB
    - daysSinceFri * 86400000
    - d.getUTCHours()   * 3600000
    - d.getUTCMinutes() * 60000
    - d.getUTCSeconds() * 1000
    - d.getUTCMilliseconds();
  return midnight - WIB_MS;
}

// ── Queue processor ───────────────────────────────────────
async function run() {
  const root = db.ref(BASE);
  const [videosSnap, membersSnap] = await Promise.all([
    root.child('videos').once('value'),
    root.child('members').once('value'),
  ]);

  const videos  = videosSnap.val()  || {};
  const members = membersSnap.val() || {};

  const now       = Date.now();
  const lastReset = getLastFridayWIB();
  const cutoff24h = now - 24 * 3600000;

  let released = 0;
  let deleted  = 0;
  let expired  = 0;

  const updates = {};  // multi-path update object for root.ref(BASE).update()

  for (const [vidId, v] of Object.entries(videos)) {
    // ── Release scheduled videos ───────────────────────────
    if (v.status === 'scheduled' && v.scheduledFor && v.scheduledFor <= now) {
      const owner      = v.ownerKey || v.owner;
      const ownerData  = members[owner] || {};
      const ownerStats = ownerData.stats || {};
      const bal        = (ownerStats.given || 0) - (ownerStats.received || 0);
      const total      = ownerData.postsTotal || 0;

      if (total >= 2 && bal <= BAL_LIMIT) {
        // Balance too low — auto-delete
        updates[`videos/${vidId}`] = null;
        if (owner) {
          const notifKey = `notif_${now}_${Math.random().toString(36).slice(2, 7)}`;
          updates[`members/${owner}/notifications/${notifKey}`] = {
            ts: now, emoji: '⚠️', msgKey: 'queueBalanceDel',
          };
        }
        deleted++;
        console.log(`  DELETE  ${vidId} (owner: ${owner}, balance: ${bal})`);
      } else {
        updates[`videos/${vidId}/status`]   = 'open';
        updates[`videos/${vidId}/postedAt`] = v.scheduledFor || now;
        if (owner) updates[`members/${owner}/lastPost`] = now;
        released++;
        console.log(`  RELEASE ${vidId} → open (owner: ${owner})`);
      }
      continue;
    }

    // ── Expire stale pre-reset open/scheduled videos ───────
    if (v.status === 'open' || v.status === 'scheduled') {
      const postedAt = v.postedAt || 0;
      if (postedAt < lastReset && postedAt < cutoff24h) {
        updates[`videos/${vidId}/status`] = 'expired';
        expired++;
        console.log(`  EXPIRE  ${vidId} (postedAt: ${new Date(postedAt).toISOString()})`);
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    await root.update(updates);
    console.log(`\nWrote ${Object.keys(updates).length} update(s) to Firebase.`);
  }

  console.log(`\nDone: ${released} released, ${expired} expired, ${deleted} balance-deleted`);
  await admin.app().delete();
}

run().catch(err => { console.error(err); process.exit(1); });
