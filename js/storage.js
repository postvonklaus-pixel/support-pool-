/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — localStorage Wrapper
   ═══════════════════════════════════════════════════════ */

const PREFIX = 'nova_';

function key(k) { return PREFIX + k; }

export const storage = {
  get(k, fallback = null) {
    try {
      const raw = localStorage.getItem(key(k));
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  },
  set(k, val) {
    try { localStorage.setItem(key(k), JSON.stringify(val)); return true; }
    catch { return false; }
  },
  remove(k) {
    try { localStorage.removeItem(key(k)); } catch {}
  },
  clear() {
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith(PREFIX))
        .forEach(k => localStorage.removeItem(k));
    } catch {}
  }
};

// ── Session helpers ────────────────────────────────────────
const SESSION_TTL = 24 * 3600 * 1000; // 24h

export function saveSession(username) {
  storage.set('session', { username, ts: Date.now() });
}

export function loadSession() {
  const s = storage.get('session');
  if (!s || !s.username) return null;
  if (Date.now() - s.ts > SESSION_TTL) { storage.remove('session'); return null; }
  return s.username;
}

export function clearSession() {
  storage.remove('session');
}

// ── Theme ──────────────────────────────────────────────────
export function getTheme()        { return storage.get('theme', 'dark'); }
export function setTheme(theme)   { storage.set('theme', theme); applyTheme(theme); }
export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : '');
}

// ── Language ───────────────────────────────────────────────
export function getLang() { return storage.get('lang', 'de'); }
export function setLang(l) { storage.set('lang', l); }

// ── PIN ────────────────────────────────────────────────────
export function getPinSkipped() { return storage.get('pin_skipped', false); }
export function setPinSkipped(v) { storage.set('pin_skipped', v); }
