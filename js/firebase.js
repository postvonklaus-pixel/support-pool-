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

let _db   = null;
let _fns  = null;
let _dbRef = null;
let _onUpdate = null;

export function initFirebase(onUpdate) {
  _onUpdate = onUpdate;

  let app;
  try {
    app = firebase.initializeApp(FIREBASE_CONFIG);
  } catch (e) {
    // Already initialized (e.g., hot-reload)
    app = firebase.app();
  }
  _db  = firebase.database(app);
  _fns = firebase.functions(app);

  _dbRef = _db.ref('/');

  // Set up continuous listener (non-blocking)
  _dbRef.on('value', snap => {
    const data = snap.val() || {};
    if (_onUpdate) _onUpdate(data);
  }, err => {
    console.error('[firebase] listener error:', err);
  });

  // Return a Promise that resolves on first data OR after 6s timeout
  const dataPromise = new Promise((resolve) => {
    _dbRef.once('value')
      .then(snap => { if (_onUpdate) _onUpdate(snap.val() || {}); resolve(); })
      .catch(err => { console.error('[firebase] once error:', err); resolve(); });
  });
  const timeout = new Promise(resolve => setTimeout(resolve, 6000));

  return Promise.race([dataPromise, timeout]);
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
  _db.ref('/').update(updates).catch(err => console.error('[firebase] write error:', err));
}, 300);

// ── Full save (replaces entire DB) ───────────────────────
export function saveDB(data) {
  if (!_db) return;
  _db.ref('/').set(data).catch(err => console.error('[firebase] save error:', err));
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
  const snap = await _db.ref(path).once('value');
  return snap.val();
}

// ── Presence ─────────────────────────────────────────────
export function setPresence(username, online) {
  if (!_db || !username) return;
  const ref = _db.ref(`members/${username}/online`);
  if (online) {
    ref.set(true);
    ref.onDisconnect().set(false);
  } else {
    ref.set(false);
  }
}
