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

// Individual paths to read — fallback when root read is blocked by rules
const DB_PATHS = ['members', 'videos', 'messages', 'settings', 'groups', 'chat'];

let _db   = null;
let _fns  = null;
let _dbRef = null;
let _onUpdate = null;
let _partialData = {};         // accumulates data from individual path listeners
let _usingIndividual = false;  // true when root listener failed

export function initFirebase(onUpdate) {
  _onUpdate = onUpdate;

  let app;
  try {
    app = firebase.initializeApp(FIREBASE_CONFIG);
  } catch (e) {
    app = firebase.app();
  }
  _db  = firebase.database(app);
  _fns = firebase.functions(app);

  _dbRef = _db.ref('/');

  // Primary: listen on root '/'
  _dbRef.on('value', snap => {
    if (_usingIndividual) return; // already fell back
    const data = snap.val() || {};
    if (_onUpdate) _onUpdate(data);
  }, err => {
    console.error('[firebase] root read blocked (' + (err.code || err.message) + ') — falling back to individual paths');
    _usingIndividual = true;
    _subscribeIndividualPaths();
  });

  // Resolve the boot promise on first data OR after 6 s
  const dataPromise = new Promise((resolve) => {
    _dbRef.once('value')
      .then(snap => {
        if (!_usingIndividual && _onUpdate) _onUpdate(snap.val() || {});
        resolve();
      })
      .catch(err => {
        // Root once() also failed — individual paths will handle it
        console.error('[firebase] root once blocked (' + (err.code || err.message) + ')');
        if (!_usingIndividual) {
          _usingIndividual = true;
          _subscribeIndividualPaths();
        }
        resolve();
      });
  });

  return Promise.race([dataPromise, new Promise(r => setTimeout(r, 6000))]);
}

// ── Fallback: one listener per path ──────────────────────
function _subscribeIndividualPaths() {
  if (!_db) return;
  _partialData = {};

  DB_PATHS.forEach(path => {
    _db.ref(path).on('value', snap => {
      _partialData[path] = snap.val() || {};
      if (_onUpdate) _onUpdate({ ..._partialData });
    }, err => {
      console.error('[firebase] path /' + path + ' error:', err.code || err.message);
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
  _db.ref('/').update(updates).catch(err => console.error('[firebase] write error:', err));
}, 300);

// ── Full save ─────────────────────────────────────────────
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
