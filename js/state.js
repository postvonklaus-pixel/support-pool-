/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Central State Store (Pub/Sub)
   ═══════════════════════════════════════════════════════ */

const _listeners = new Set();

export const state = {
  lang: 'de',
  currentUser: null,
  db: {
    groups:   {},
    members:  {},
    videos:   {},
    messages: {},
    chat:     {},
    settings: {}
  },
  ui: {
    activeScreen: 'login',
    modals: new Set(),
    headerVisible: false,
    navVisible: false
  }
};

/**
 * Set a nested state value by dot-path.
 * setState('ui.activeScreen', 'dashboard')
 */
export function setState(path, value) {
  const keys = path.split('.');
  let target = state;
  for (let i = 0; i < keys.length - 1; i++) {
    target = target[keys[i]];
  }
  target[keys[keys.length - 1]] = value;
  _notify({ path, value });
}

/**
 * Merge an object into state.db from a Firebase snapshot.
 */
export function mergeDB(snapshot) {
  const data = snapshot || {};
  state.db.groups   = data.groups   || {};
  state.db.members  = data.members  || {};
  state.db.videos   = data.videos   || {};
  state.db.messages = data.messages || {};
  state.db.chat     = data.chat     || {};
  state.db.settings = data.settings || {};
  _notify({ path: 'db', value: state.db });
}

/**
 * Subscribe to state changes. Returns an unsubscribe fn.
 * fn(change, state) — change = { path, value }
 */
export function subscribe(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

/**
 * Subscribe to a specific path only.
 */
export function watch(path, fn) {
  return subscribe((change, s) => {
    if (change.path === path || change.path.startsWith(path + '.')) {
      fn(change.value, s);
    }
  });
}

function _notify(change) {
  _listeners.forEach(fn => {
    try { fn(change, state); } catch (e) { console.error('[state]', e); }
  });
}
