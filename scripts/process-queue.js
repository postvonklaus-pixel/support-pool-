#!/usr/bin/env node
/**
 * Server-side queue processor for NOVA Support Pool.
 * Replicates checkScheduledVideos() + _checkWeeklyCleanup() from posting.js.
 * Run via GitHub Actions cron every 2 hours so scheduled videos go live
 * even when no member is logged in.
 *
 * Requires env vars:
 *   FIREBASE_DATABASE_URL  — e.g. https://support-pool-default-rtdb.asia-southeast1.firebasedatabase.app
 *   FIREBASE_DB_SECRET     — legacy database secret from Firebase Console
 */

'use strict';

const DB_URL = process.env.FIREBASE_DATABASE_URL;
const SECRET = process.env.FIREBASE_DB_SECRET;
const BASE   = 'sp6';
const BAL_LIMIT = -10;

if (!DB_URL || !SECRET) {
  console.error('Missing FIREBASE_DATABASE_URL or FIREBASE_DB_SECRET');
  process.exit(1);
}

// ── WIB helpers (UTC+7, reset Friday 00:00 WIB) ──────────
const WIB_MS = 7 * 3600000;

function getLastFridayWIB() {
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

// ── Firebase REST helpers ─────────────────────────────────
async function fbGet(path) {
  const url = `${DB_URL}/${BASE}/${path}.json?auth=${SECRET}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

async function fbPatch(path, data) {
  const url = `${DB_URL}/${BASE}/${path}.json?auth=${SECRET}`;
  const res = await fetch(url, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status}`);
  return res.json();
}

async function fbDelete(path) {
  const url = `${DB_URL}/${BASE}/${path}.json?auth=${SECRET}`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error(`DELETE ${path} → ${res.status}`);
}

// ── Queue processor ───────────────────────────────────────
async function run() {
  const [videos, members] = await Promise.all([
    fbGet('videos'),
    fbGet('members'),
  ]);

  if (!videos) { console.log('No videos found — nothing to do.'); return; }

  const now       = Date.now();
  const lastReset = getLastFridayWIB();
  const cutoff24h = now - 24 * 3600000;

  let released = 0;
  let deleted  = 0;
  let expired  = 0;

  const videoUpdates = {};   // path → value for PATCH
  const toDelete     = [];   // full video paths to DELETE

  for (const [vidId, v] of Object.entries(videos)) {
    // ── Release scheduled videos ───────────────────────────
    if (v.status === 'scheduled' && v.scheduledFor && v.scheduledFor <= now) {
      const owner      = v.ownerKey || v.owner;
      const ownerData  = members?.[owner] || {};
      const ownerStats = ownerData.stats || {};
      const bal        = (ownerStats.given || 0) - (ownerStats.received || 0);
      const total      = ownerData.postsTotal || 0;

      if (total >= 2 && bal <= BAL_LIMIT) {
        // Balance too low — auto-delete
        toDelete.push(vidId);
        // Write notification
        const notifKey = `notif_${now}_${Math.random().toString(36).slice(2,7)}`;
        if (owner) {
          videoUpdates[`../members/${owner}/notifications/${notifKey}`] = {
            ts: now, emoji: '⚠️', msgKey: 'queueBalanceDel',
          };
        }
        deleted++;
        console.log(`  DELETE ${vidId} (owner ${owner}, balance ${bal})`);
      } else {
        videoUpdates[`videos/${vidId}/status`]   = 'open';
        videoUpdates[`videos/${vidId}/postedAt`] = now;
        if (owner) videoUpdates[`members/${owner}/lastPost`] = now;
        released++;
        console.log(`  RELEASE ${vidId} → open (owner ${owner})`);
      }
      continue;
    }

    // ── Expire stale pre-reset open/scheduled videos ───────
    if (v.status === 'open' || v.status === 'scheduled') {
      const postedAt = v.postedAt || 0;
      if (postedAt < lastReset && postedAt < cutoff24h) {
        videoUpdates[`videos/${vidId}/status`] = 'expired';
        expired++;
        console.log(`  EXPIRE ${vidId} (postedAt ${new Date(postedAt).toISOString()})`);
      }
    }
  }

  // Apply all updates in one PATCH
  if (Object.keys(videoUpdates).length > 0) {
    // Separate member updates from video updates (different paths)
    const memberUpdates = {};
    const vidUpdates    = {};
    for (const [k, v] of Object.entries(videoUpdates)) {
      if (k.startsWith('../members/')) {
        memberUpdates[k.replace('../members/', '')] = v;
      } else {
        vidUpdates[k] = v;
      }
    }
    if (Object.keys(vidUpdates).length)    await fbPatch('', vidUpdates);
    if (Object.keys(memberUpdates).length) await fbPatch('members', memberUpdates);
  }

  // Delete balance-failed videos
  for (const vidId of toDelete) {
    await fbDelete(`videos/${vidId}`);
  }

  console.log(`\nDone: ${released} released, ${expired} expired, ${deleted} balance-deleted`);
}

run().catch(err => { console.error(err); process.exit(1); });
