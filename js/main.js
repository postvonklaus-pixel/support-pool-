/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Entry Point & Boot Sequence
   ═══════════════════════════════════════════════════════ */

import { state, setState, subscribe } from './state.js';
import { storage, loadSession, getLang } from './storage.js';
import { initTheme } from './features/theme.js';
import { ge, toast, getLastFridayWIB } from './utils.js';
import { initFirebase, saveDB, writeDB } from './firebase.js';
import { initI18n, setLang } from './i18n.js';
import { initEvents } from './events.js';
import { initRouter, goScreen } from './router.js';
import { initOffline } from './features/offline.js';

// ── Boot sequence ─────────────────────────────────────────
async function boot() {
  // 1. Apply saved theme immediately (prevents flash)
  try { initTheme(); } catch (e) { console.error('[boot] theme', e); }

  // 2. Init i18n
  try {
    const savedLang = getLang();
    initI18n(savedLang);
    setState('lang', savedLang);
  } catch (e) { console.error('[boot] i18n', e); }

  // 3. Init event delegation
  try { initEvents(); } catch (e) { console.error('[boot] events', e); }

  // 3b. Init offline detection
  try { initOffline(); } catch (e) { /* non-fatal */ }

  // 4. Init router
  try { initRouter(); } catch (e) { console.error('[boot] router', e); }

  // 5. Show app + login screen IMMEDIATELY (do not wait for Firebase)
  _showApp();
  const savedUser = loadSession();
  // Show login right away; Firebase will update the screen once it connects
  if (!savedUser) {
    goScreen('login');
  } else {
    // Show login while we wait for Firebase; it'll redirect after DB loads
    goScreen('login');
  }

  // 6. Connect to Firebase in the background (non-blocking, max 8s)
  const fbTimeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Firebase timeout')), 12000)
  );
  try {
    await Promise.race([initFirebase(onDBUpdate), fbTimeout]);
    // If session exists and DB is now loaded, redirect to dashboard
    if (savedUser && state.db.members?.[savedUser]) {
      await loginAs(savedUser);
    }
  } catch (err) {
    console.error('[boot] Firebase error (non-fatal):', err);
    import('./components/toast.js').then(m => m.toast('Offline-Modus — bitte reload', 'warning', 5000));
  }

  // 7. Start periodic render tick (15s)
  setInterval(tick, 15000);
}

function _showApp() {
  const loading = ge('app-loading');
  const app     = ge('app');
  if (app) app.style.display = 'flex';
  if (loading) {
    loading.classList.add('fade-out');
    // Belt-and-suspenders: remove after transition OR after 600ms, whichever first
    const remove = () => { try { loading.remove(); } catch {} };
    loading.addEventListener('transitionend', remove, { once: true });
    setTimeout(remove, 600);
  }
}

// ── Firebase DB update handler ────────────────────────────
let _dbFirstLoad = true;

function onDBUpdate(snapshot) {
  const data = snapshot || {};
  state.db.groups   = data.groups   || {};
  state.db.members  = data.members  || {};
  state.db.videos   = data.videos   || {};
  state.db.messages = data.messages || {};
  state.db.chat     = data.chat     || {};
  state.db.settings = data.settings || {};

  // Notify all subscribers
  setState('db', state.db);

  // On first load: if we have a valid session, redirect to dashboard
  if (_dbFirstLoad) {
    _dbFirstLoad = false;
    const savedUser = loadSession();
    if (savedUser && state.db.members?.[savedUser] && state.ui.activeScreen === 'login') {
      loginAs(savedUser);
      return;
    }
  }

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

  // Language priority: explicit login-screen selection > DB stored value > 'de'
  const selected = state.userSelectedLang;
  const targetLang = selected || u.lang || 'de';
  if (selected && selected !== u.lang) {
    import('./firebase.js').then(m => m.writeDB(`members/${username}/lang`, selected));
  }
  setState('userSelectedLang', null);
  await setLang(targetLang);
  setState('lang', targetLang);

  // Show chrome
  const header = ge('app-header');
  const nav    = ge('app-nav');
  if (header) header.classList.remove('hidden');
  if (nav)    nav.classList.remove('hidden');

  // Update header
  updateHeader(username, u);

  // Auto weekly reset (runs silently on first login of each new week)
  _checkAutoWeekReset();

  // Go to dashboard
  goScreen('dashboard');

  // Save session
  import('./storage.js').then(m => m.saveSession(username));

  // Show onboarding for first-time users
  import('./features/onboarding.js').then(m => {
    if (m.shouldShowOnboarding(username)) m.startOnboarding(username);
  });

  return true;
}

// ── Auto Weekly Reset (Friday 00:00 WIB) ─────────────────
function _checkAutoWeekReset() {
  const lastReset  = state.db.settings?.lastWeeklyReset || 0;
  const lastFriday = getLastFridayWIB();
  if (lastReset >= lastFriday) return;

  const members = state.db.members || {};
  Object.keys(members).forEach(k => writeDB(`members/${k}/weeklyGiven`, 0));
  writeDB('settings/lastWeeklyReset', Date.now());
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
  // Do not re-render while user is actively typing — prevents FAQ/broadcast/input loss
  const active = document.activeElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
  import('./router.js').then(m => m.renderActive({ debounce: true }));
}

// Service Worker intentionally not registered — index.html nuke script
// deregisters any existing SW so JS is always served fresh from the network.

// ── Expose globals needed by firebase callbacks ───────────
window._nova = { loginAs, logout, state, saveDB };

// ── Start ─────────────────────────────────────────────────
boot().catch(err => console.error('[nova] boot failed:', err));
