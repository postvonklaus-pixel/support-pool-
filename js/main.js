/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Entry Point & Boot Sequence
   ═══════════════════════════════════════════════════════ */

import { state, setState, subscribe } from './state.js';
import { storage, loadSession, applyTheme, getLang } from './storage.js';
import { ge, toast } from './utils.js';
import { initFirebase, saveDB } from './firebase.js';
import { initI18n, setLang } from './i18n.js';
import { initEvents } from './events.js';
import { initRouter, goScreen } from './router.js';

// ── Boot sequence ─────────────────────────────────────────
async function boot() {
  // 1. Apply saved theme immediately (prevents flash)
  applyTheme(storage.get('theme', 'dark'));

  // 2. Init i18n — default or saved lang
  const savedLang = getLang();
  await initI18n(savedLang);
  setState('lang', savedLang);

  // 3. Init event delegation (must be early)
  initEvents();

  // 4. Init router
  initRouter();

  // 5. Connect to Firebase
  let dbReady = false;
  try {
    await initFirebase(onDBUpdate);
    dbReady = true;
  } catch (err) {
    console.error('[boot] Firebase error:', err);
    toast('Verbindungsfehler — Offline-Modus', 'error');
  }

  // 6. Show app, hide loading
  const loading = ge('app-loading');
  const app     = ge('app');
  if (loading) {
    loading.classList.add('fade-out');
    loading.addEventListener('transitionend', () => loading.remove(), { once: true });
  }
  if (app) app.style.display = '';

  // 7. Try to restore session
  const savedUser = loadSession();
  if (savedUser && state.db.members && state.db.members[savedUser]) {
    await loginAs(savedUser);
  } else {
    goScreen('login');
  }

  // 8. Start periodic render tick (15s) for timers, live data
  setInterval(tick, 15000);
}

// ── Firebase DB update handler ────────────────────────────
function onDBUpdate(snapshot) {
  const data = snapshot || {};
  state.db.groups   = data.groups   || {};
  state.db.members  = data.members  || {};
  state.db.videos   = data.videos   || {};
  state.db.messages = data.messages || {};
  state.db.chat     = data.chat     || {};
  state.db.settings = data.settings || {};

  // Notify all subscribers
  import('./state.js').then(({ setState }) => {
    setState('db', state.db);
  });

  // Re-render active screen
  tick();

  // Broadcast check
  checkBroadcast();
}

// ── Login ─────────────────────────────────────────────────
export async function loginAs(username) {
  const u = state.db.members[username];
  if (!u) { toast('Nutzer nicht gefunden', 'error'); return false; }

  setState('currentUser', username);

  // Set user's preferred lang
  if (u.lang) {
    await setLang(u.lang);
    setState('lang', u.lang);
  }

  // Show chrome
  const header = ge('app-header');
  const nav    = ge('app-nav');
  if (header) header.classList.remove('hidden');
  if (nav)    nav.classList.remove('hidden');

  // Update header
  updateHeader(username, u);

  // Go to dashboard
  goScreen('dashboard');

  // Save session
  import('./storage.js').then(m => m.saveSession(username));

  return true;
}

// ── Logout ────────────────────────────────────────────────
export function logout() {
  setState('currentUser', null);
  import('./storage.js').then(m => m.clearSession());
  const header = ge('app-header');
  const nav    = ge('app-nav');
  if (header) header.classList.add('hidden');
  if (nav)    nav.classList.add('hidden');
  goScreen('login');
}

// ── Header update ─────────────────────────────────────────
function updateHeader(username, u) {
  const avatar = ge('header-avatar');
  const name   = ge('header-username');
  if (avatar) {
    avatar.textContent = (username || '?').slice(0, 2).toUpperCase();
    import('./utils.js').then(({ avatarGradient }) => {
      avatar.style.background = avatarGradient(username);
    });
  }
  if (name) name.textContent = username;
}

// ── Broadcast banner ──────────────────────────────────────
function checkBroadcast() {
  const settings = state.db.settings || {};
  const banner   = ge('broadcast-banner');
  if (!banner) return;
  if (settings.broadcast && settings.broadcastActive) {
    banner.textContent = settings.broadcast;
    banner.classList.add('visible');
  } else {
    banner.classList.remove('visible');
  }
}

// ── Tick (periodic render refresh) ───────────────────────
function tick() {
  if (!state.currentUser) return;
  import('./router.js').then(m => m.renderActive());
}

// ── Service Worker registration ───────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// ── Expose globals needed by firebase callbacks ───────────
window._nova = { loginAs, logout, state, saveDB };

// ── Start ─────────────────────────────────────────────────
boot().catch(err => console.error('[nova] boot failed:', err));
