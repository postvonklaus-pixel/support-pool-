/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Ticket 1: RTDB Presence
   Path: {base}/presence/pool/{uid} = { ts, uid }
   Separate listener → does NOT trigger full app re-render.
   onDisconnect().remove() + 60s heartbeat guard against stale entries.
   ═══════════════════════════════════════════════════════ */

import { state }              from '../state.js';
import { getDB, getDBBase }   from '../firebase.js';

const STALE_MS  = 2 * 60 * 1000; // treat as offline if heartbeat stopped > 2 min
const BEAT_MS   = 60 * 1000;     // heartbeat interval

let _username      = '';
let _heartbeat     = null;
let _poolRef       = null;
let _listener      = null;
let _myRef         = null;

export function initPresence(username) {
  if (!username) return;
  if (!_featureEnabled()) return;

  _username = username;

  const db   = getDB();
  const base = getDBBase();
  if (!db) return;

  const pfx = base ? base + '/' : '';
  _myRef    = db.ref(`${pfx}presence/pool/${username}`);
  _poolRef  = db.ref(`${pfx}presence/pool`);

  const beat = () => _myRef.set({ ts: Date.now(), uid: username });
  beat();
  _myRef.onDisconnect().remove();

  clearInterval(_heartbeat);
  _heartbeat = setInterval(beat, BEAT_MS);

  // Live listener — only patches the DOM badge, never re-renders the app
  _listener = _poolRef.on('value', snap => {
    const all   = snap.val() || {};
    const now   = Date.now();
    const count = Object.values(all).filter(p => p?.ts && now - p.ts < STALE_MS).length;
    state._onlineCount = Math.max(0, count);
    _patchBadge(state._onlineCount);
  });
}

export function cleanupPresence() {
  clearInterval(_heartbeat);
  _heartbeat = null;

  if (_poolRef && _listener !== null) {
    _poolRef.off('value', _listener);
    _poolRef  = null;
    _listener = null;
  }

  if (_myRef) {
    _myRef.remove().catch(() => {});
    _myRef = null;
  }

  _username = '';
  state._onlineCount = 0;
}

export function getOnlineCount() {
  return state._onlineCount ?? 0;
}

function _patchBadge(count) {
  const el = document.getElementById('pool-online-count');
  if (!el) return;
  el.textContent = count === 0 ? '— niemand online' : `🟢 ${count} online`;
}

function _featureEnabled() {
  return state.db?.settings?.features?.presence !== false;
}
