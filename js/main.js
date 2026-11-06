/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Entry Point & Boot Sequence
   ═══════════════════════════════════════════════════════ */

import { state, setState, subscribe } from './state.js';
import { storage, loadSession, getLang, clearSession, saveSession } from './storage.js';
import { initTheme } from './features/theme.js';
import { ge, toast, getLastFridayWIB, fbDec } from './utils.js';
import { initFirebase, saveDB, writeDB, getPendingPaths } from './firebase.js';
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

  // 6. Connect to Firebase in the background (non-blocking, max 10s)
  const fbTimeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Firebase timeout')), 10000)
  );
  try {
    await Promise.race([initFirebase(onDBUpdate), fbTimeout]);
    // If session exists and DB is now loaded, redirect to dashboard
    if (savedUser && state.db.members?.[savedUser]) {
      await loginAs(savedUser, { silent: true });
    }
  } catch (err) {
    console.error('[boot] Firebase error (non-fatal):', err);
    import('./components/toast.js').then(m => m.toast('Offline-Modus — bitte reload', 'warning', 5000));
  }

  // 7. Start periodic render tick (15s)
  setInterval(tick, 15000);

  // 8. Start global countdown ticker (updates [data-expires] spans every 1s)
  import('./features/timers.js').then(m => m.startCountdownTicker());
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

// Re-applies queued writes (paths like 'members/key/stats/given') after
// Firebase replaces state.db, so optimistic updates survive the next snapshot.
function _applyPendingWrites(pending) {
  const entries = Object.entries(pending);
  if (!entries.length) return;
  entries.forEach(([path, value]) => {
    const parts = path.split('/');
    let node = state.db;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      if (!node[k] || typeof node[k] !== 'object') node[k] = {};
      node = node[k];
    }
    node[parts[parts.length - 1]] = value;
  });
}

function onDBUpdate(snapshot) {
  const data    = snapshot || {};
  const pending = getPendingPaths(); // capture before overwriting state
  state.db.groups   = data.groups   || state.db.groups   || {};
  // Merge incoming members with existing — prevents partial _subscribeIndividualPaths
  // snapshots from dropping members not yet in the partial set, which would cause
  // loginAs to fail with "Benutzer nicht gefunden" for those members.
  // Full snapshots (from _dbRef.on) always win since they contain all members.
  if (data.members && Object.keys(data.members).length > 0) {
    state.db.members = { ...(state.db.members || {}), ...data.members };
  } else if (!state.db.members || Object.keys(state.db.members).length === 0) {
    state.db.members = {};
  }
  // (If data.members is empty/absent and we already have members, keep them unchanged)
  state.db.videos   = data.videos   || state.db.videos   || {};
  state.db.messages = data.messages || state.db.messages || {};
  state.db.chat     = data.chat     || state.db.chat     || {};
  state.db.settings = data.settings || state.db.settings || {};
  _applyPendingWrites(pending); // re-apply unconfirmed optimistic writes

  // Notify all subscribers
  setState('db', state.db);

  // Auto-redirect returning user: fires whenever members become available
  // while user is still on login screen and not yet logged in.
  // Normalize savedUser against DB keys (handles @ prefix mismatch from old sessions).
  const savedUser = loadSession();
  if (savedUser && state.ui.activeScreen === 'login' && !state.currentUser) {
    const normSaved = savedUser.replace(/^@+/, '').toLowerCase();
    const matchKey  = state.db.members?.[savedUser]
      ? savedUser
      : Object.keys(state.db.members || {}).find(k =>
          k.replace(/^@+/, '').toLowerCase() === normSaved
        );
    if (matchKey) {
      loginAs(matchKey, { silent: true });
      return;
    }
  }

  // Re-render active screen
  tick();

  // Broadcast check
  checkBroadcast();
}

// ── Login ─────────────────────────────────────────────────
export async function loginAs(username, { silent = false, isNew = false } = {}) {
  let u = state.db.members[username];
  if (!u) {
    // Members may still be settling after page load — retry once after a brief
    // delay before giving up. Handles a race where state.db.members is
    // momentarily incomplete on the very first login attempt.
    await new Promise(r => setTimeout(r, 350));
    u = state.db.members[username];
  }
  if (!u) {
    if (!silent) {
      import('./i18n.js').then(({ t }) => toast(t('loginNotFound') || 'Nutzer nicht gefunden', 'error'));
    }
    return false;
  }

  setState('currentUser', username);

  // Track presence: write lastSeen + online flag, start heartbeat
  writeDB(`members/${username}/lastSeen`, Date.now());
  writeDB(`members/${username}/online`, true);
  if (window._lastSeenInterval) clearInterval(window._lastSeenInterval);
  window._lastSeenInterval = setInterval(() => {
    if (state.currentUser) writeDB(`members/${state.currentUser}/lastSeen`, Date.now());
  }, 5 * 60 * 1000);

  // Ticket 1: RTDB presence (online count in pool chat header)
  import('./features/presence.js').then(m => m.initPresence(username));

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

  // Client-side fallback for missed scheduled videos (CF is primary)
  import('./features/posting.js').then(m => m.checkPendingOnBoot());

  // Go to dashboard
  goScreen('dashboard');

  // Save session synchronously so loadSession() reflects it immediately
  saveSession(username);

  // New-member setup (group + notifications) — runs here because Firebase is
  // guaranteed to be connected by login time, unlike at registration time
  if (isNew) {
    _setupNewMember(username, u);
  }

  // Show onboarding for first-time users
  import('./features/onboarding.js').then(m => {
    if (m.shouldShowOnboarding(username)) m.startOnboarding(username);
  });

  return true;
}

// ── New-member setup (runs on first loginAs) ──────────────
function _setupNewMember(key, u) {
  import('./firebase.js').then(({ writeDB: wDB }) => {
    import('./features/notifications.js').then(({ addNotif }) => {
      // Group assignment
      const groups = state.db.groups || {};
      const groupEntries = Object.entries(groups);
      if (groupEntries.length > 0 && !u.group) {
        const toArr = (v) => Array.isArray(v) ? v : Object.values(v || {});
        const [bestGid, bestG] = groupEntries.reduce((best, [gid, g]) => {
          return toArr(g.members).length < toArr(best[1].members).length ? [gid, g] : best;
        });
        wDB(`members/${key}/group`, bestGid);
        const arr = toArr(bestG.members);
        wDB(`groups/${bestGid}/members`, [...arr, key]);
      }

      // Notify all existing members (active + admin)
      const name = u.name || key;
      Object.entries(state.db.members || {}).forEach(([mKey, m]) => {
        if (mKey === key) return;
        if (m.status === 'inactive' || m.status === 'kicked') return;
        addNotif(mKey, '👋', null, null, { msgKey: 'notifNewMember', params: { name } });
      });

      // Ticket 3: System message "👋 @username ist dem Pool beigetreten"
      import('./features/systemMessages.js').then(m => m.postNewMemberActivity(key));
    });
  });
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
  if (state.currentUser) writeDB(`members/${state.currentUser}/online`, false);
  if (window._lastSeenInterval) { clearInterval(window._lastSeenInterval); window._lastSeenInterval = null; }
  import('./features/presence.js').then(m => m.cleanupPresence());
  setState('currentUser', null);
  clearSession(); // synchronous — must run before goScreen so onDBUpdate sees no session
  const header = ge('app-header');
  const nav    = ge('app-nav');
  if (header) header.classList.add('hidden');
  if (nav)    nav.classList.add('hidden');
  goScreen('login');
}

// ── Header update ─────────────────────────────────────────
function updateHeader(username, u) {
  const decoded = fbDec(username);
  const avatar  = ge('header-avatar');
  const name    = ge('header-username');
  if (avatar) {
    avatar.textContent = (decoded || '?').slice(0, 2).toUpperCase();
    import('./utils.js').then(({ avatarGradient }) => {
      avatar.style.background = avatarGradient(username);
    });
  }
  if (name) name.textContent = decoded;
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

  // Always check scheduled videos regardless of UI state
  import('./features/posting.js').then(m => m.checkScheduledVideos());

  // Skip while user is actively typing
  const ae = document.activeElement;
  if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
  // Skip if a modal/dialog is open
  if (document.querySelector('.modal.active, [role="dialog"]:not([hidden])')) return;
  // Skip if a FAQ item is expanded
  if (document.querySelector('.faq-item.open')) return;
  // Skip on settings screen to prevent scroll-jump
  const activeScreen = document.querySelector('.screen.active');
  if (activeScreen?.id === 'screen-settings') return;
  // Skip for 5s after user last scrolled
  if (Date.now() - (window._lastScrollTime || 0) < 5000) return;
  import('./router.js').then(m => m.renderActive({ debounce: true }));
}

// Track scroll activity to guard tick()
document.addEventListener('scroll', () => { window._lastScrollTime = Date.now(); },
  { passive: true, capture: true });

// Service Worker intentionally not registered — index.html nuke script
// deregisters any existing SW so JS is always served fresh from the network.

// ── Expose globals needed by firebase callbacks ───────────
window._nova = { loginAs, logout, state, saveDB };

// ── Start ─────────────────────────────────────────────────
boot().catch(err => console.error('[nova] boot failed:', err));
