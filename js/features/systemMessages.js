/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Tickets 2+3: System Messages
   All events use the same type:'system' shape in
   chat/pool/messages/{key}.
   System messages are excluded from unread counters and push.
   ═══════════════════════════════════════════════════════ */

import { state }   from '../state.js';
import { writeDB } from '../firebase.js';
import { fbDec }   from '../utils.js';

// Batch window: all supports for the same video in one minute → one message
const BATCH_MS  = 60 * 1000;
// Milestone thresholds (fires once per threshold, idempotent)
const MILESTONES = [5, 10, 25, 50, 100];

// ── Support activity (Ticket 2) ───────────────────────────
export function postSupportActivity(supporter, ownerKey) {
  if (!_enabled()) return;
  if (!supporter || !ownerKey) return;

  const ownerDisplay = _displayName(ownerKey);
  const bucket  = Math.floor(Date.now() / BATCH_MS);
  const msgKey  = `sys_sup_${ownerKey}_${bucket}`;
  const existing = state.db.chat?.pool?.messages?.[msgKey];

  // Accumulate supporters in this time-bucket (dedup)
  const batch = [...new Set([...(existing?._batch || []), supporter])];
  const text  = _supportText(batch, ownerDisplay);

  writeDB(`chat/pool/messages/${msgKey}`, {
    type:   'system',
    event:  'support',
    text,
    ts:     existing?.ts || Date.now(),
    _batch: batch,
  });
}

// ── Milestone (Ticket 3) ──────────────────────────────────
export function postMilestoneActivity(ownerKey, count) {
  if (!_enabled()) return;
  if (!MILESTONES.includes(count)) return;

  const msgKey = `sys_ms_${ownerKey}_${count}`;
  if (state.db.chat?.pool?.messages?.[msgKey]) return; // idempotent

  const ownerDisplay = _displayName(ownerKey);
  writeDB(`chat/pool/messages/${msgKey}`, {
    type:  'system',
    event: 'milestone',
    text:  `🔥 @${ownerDisplay} hat ${count} Supporter erreicht!`,
    ts:    Date.now(),
  });
}

// ── New member (Ticket 3) ─────────────────────────────────
export function postNewMemberActivity(username) {
  if (!_enabled()) return;
  if (!username) return;

  const msgKey = `sys_join_${username}`;
  if (state.db.chat?.pool?.messages?.[msgKey]) return; // idempotent

  const display = _displayName(username);
  writeDB(`chat/pool/messages/${msgKey}`, {
    type:  'system',
    event: 'newMember',
    text:  `👋 @${display} ist dem Pool beigetreten`,
    ts:    Date.now(),
  });
}

// ── Helpers ───────────────────────────────────────────────
function _supportText(supporters, owner) {
  const names = supporters.map(s => _displayName(s));
  if (names.length === 1)
    return `🎉 @${names[0]} hat @${owner} supportet`;
  if (names.length === 2)
    return `🎉 @${names[0]} und @${names[1]} haben @${owner} supportet`;
  return `🎉 @${names[0]}, @${names[1]} und ${names.length - 2} weitere haben @${owner} supportet`;
}

function _displayName(key) {
  return state.db.members?.[key]?.name || fbDec(key) || key;
}

function _enabled() {
  return state.db?.settings?.features?.systemMessages !== false;
}
