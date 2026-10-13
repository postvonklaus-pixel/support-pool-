/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Router / Screen Navigation
   ═══════════════════════════════════════════════════════ */

import { state, setState } from './state.js';
import { ge, qsa } from './utils.js';

const SCREENS = ['login','dashboard','home','profile','myvideos','caption','settings','admin','chat'];
const NAV_MAP  = { home:'ni-feed', myvideos:'ni-meine', chat:'ni-chat', profile:'ni-ich' };

// Screen module cache
const _mods = {};

export function initRouter() {
  // Nothing to set up — navigation is driven by goScreen()
}

export async function goScreen(id) {
  if (!SCREENS.includes(id)) return;
  const prev = state.ui.activeScreen;
  if (prev === id) { renderActive(); return; }

  // Deactivate old
  const oldEl = ge(`screen-${prev}`);
  if (oldEl) oldEl.classList.remove('active');

  // Activate new
  const el = ge(`screen-${id}`);
  if (!el) return;
  el.classList.add('active', 'animate-in');
  el.addEventListener('animationend', () => el.classList.remove('animate-in'), { once: true });

  setState('ui.activeScreen', id);

  // Nav indicator
  updateNavIndicator(id);

  // Scroll to top
  el.scrollTop = 0;

  // Render screen
  await renderScreen(id);
}

export async function renderActive() {
  const id = state.ui.activeScreen;
  if (id) await renderScreen(id);
}

async function renderScreen(id) {
  try {
    const mod = await loadScreenMod(id);
    if (mod && typeof mod.render === 'function') mod.render();
  } catch (e) {
    console.error(`[router] render ${id} failed:`, e);
  }
}

async function loadScreenMod(id) {
  if (_mods[id]) return _mods[id];
  try {
    const mod = await import(`./screens/${id}.js`);
    _mods[id] = mod;
    return mod;
  } catch { return null; }
}

function updateNavIndicator(id) {
  // Update active nav item
  qsa('.nav-item').forEach(el => el.classList.remove('active'));
  const navId = NAV_MAP[id];
  if (navId) {
    const navEl = ge(navId);
    if (navEl) {
      navEl.classList.add('active');
      // Move indicator
      const indicator = ge('nav-indicator');
      if (indicator) {
        const rect = navEl.getBoundingClientRect();
        const navRect = navEl.closest('nav').getBoundingClientRect();
        indicator.style.left  = (rect.left - navRect.left) + 'px';
        indicator.style.width = rect.width + 'px';
      }
    }
  }
}
