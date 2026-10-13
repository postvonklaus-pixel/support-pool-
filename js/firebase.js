/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Firebase Init & Sync Layer
   ═══════════════════════════════════════════════════════ */

import { debounce } from './utils.js';

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCqJmrJOVbfY7t5pxCQXZSSMbH0nwVAjMs",
  authDomain:        "nova-support-pool.firebaseapp.com",
  databaseURL:       "https://nova-support-pool-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "nova-support-pool",
  storageBucket:     "nova-support-pool.appspot.com",
  messagingSenderId: "856327571658",
  appId:             "1:856327571658:web:ba09f7e24f70b28a6f44fa"
};

const DB_PATHS = ['members', 'videos', 'messages', 'settings', 'groups', 'chat'];

// Discovered at runtime: 'sp6' if data lives under /sp6/, '' for root
let _base = 'sp6';

let _db              = null;
let _fns             = null;
let _dbRef           = null;
let _onUpdate        = null;
let _partialData     = {};
let _usingIndividual = false;

export function initFirebase(onUpdate) {
  _onUpdate = onUpdate;

  let app;
  try { app = firebase.initializeApp(FIREBASE_CONFIG); }
  catch (e) { app = firebase.app(); }

  _db  = firebase.database(app);
  _fns = firebase.functions(app);

  const authReady = _signInAnonymously(app);

  // Resolve once first data arrives; no internal timeout — main.js controls that
  return new Promise(resolve => {
    authReady.then(() => _autoConnect(resolve));
  });
}

// Try /sp6/ first (new layout), then root (legacy layout).
// Whichever path returns a members object wins.
async function _autoConnect(resolve) {
  for (const base of ['sp6', '']) {
    try {
      const ref = _db.ref(base || '/');
      const snap = await Promise.race([
        ref.once('value'),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))
      ]);
      const val = snap.val();
      if (val && val.members && Object.keys(val.members).length > 0) {
        _base  = base;
        _dbRef = ref;
        _dbRef.on('value', s => {
          if (_usingIndividual) return;
          if (_onUpdate) _onUpdate(s.val() || {});
        }, () => { _usingIndividual = true; _subscribeIndividualPaths(); });
        if (_onUpdate) _onUpdate(val);
        resolve();
        return;
      }
    } catch (_e) { /* path denied or timed out — try next */ }
  }
  // All paths exhausted — resolve without data; login.js 12 s timeout handles UI
  resolve();
}

// ── Anonymous Auth ────────────────────────────────────────
function _signInAnonymously(app) {
  return new Promise(resolve => {
    try {
      const auth = firebase.auth(app);
      const unsub = auth.onAuthStateChanged(user => {
        unsub();
        if (user) { resolve(); return; }
        auth.signInAnonymously()
          .then(resolve)
          .catch(err => { console.warn('[firebase] anon auth failed (' + err.code + ')'); resolve(); });
      });
    } catch (e) {
      console.warn('[firebase] auth unavailable:', e.message);
      resolve();
    }
  });
}

// ── Fallback: individual path listeners ───────────────────
function _subscribeIndividualPaths() {
  if (!_db) return;
  _partialData = {};
  const pfx = _base ? _base + '/' : '';
  DB_PATHS.forEach(path => {
    _db.ref(pfx + path).on('value', snap => {
      _partialData[path] = snap.val() || {};
      if (_onUpdate) _onUpdate({ ..._partialData });
    }, err => {
      console.error('[firebase]', pfx + path, 'blocked:', err.code || err.message);
    });
  });
}

// ── Write (debounced) ─────────────────────────────────────
const _pendingWrites = new Map();

export function writeDB(path, value) {
  _pendingWrites.set(path, value);
  _flush();
}

const _flush = debounce(() => {
  if (!_db || !_pendingWrites.size) return;
  const updates = {};
  _pendingWrites.forEach((val, path) => { updates[path] = val; });
  _pendingWrites.clear();
  _db.ref(_base || '/').update(updates)
    .catch(err => console.error('[firebase] write error:', err));
}, 300);

// ── Full save ─────────────────────────────────────────────
export function saveDB(data) {
  if (!_db) return;
  _db.ref(_base || '/').set(data)
    .catch(err => console.error('[firebase] save error:', err));
}

// ── Call Firebase Function ────────────────────────────────
export async function callFn(name, payload) {
  if (!_fns) throw new Error('Firebase not initialized');
  const fn = _fns.httpsCallable(name);
  const res = await fn(payload);
  return res.data;
}

// ── Read once ─────────────────────────────────────────────
export async function readOnce(path) {
  if (!_db) return null;
  const pfx = _base ? _base + '/' : '';
  const snap = await _db.ref(pfx + path).once('value');
  return snap.val();
}

// ── Presence ──────────────────────────────────────────────
export function setPresence(username, online) {
  if (!_db || !username) return;
  const pfx = _base ? _base + '/' : '';
  const ref  = _db.ref(pfx + 'members/' + username + '/online');
  if (online) {
    ref.set(true);
    ref.onDisconnect().set(false);
  } else {
    ref.set(false);
  }
}
