/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — 3-State Theme Manager
   Modes: 'auto' | 'light' | 'dark'
   ═══════════════════════════════════════════════════════ */

import { storage } from '../storage.js';

const STORAGE_KEY = 'theme';
const DEFAULT     = 'auto';

let _mediaQuery = null;

export function initTheme() {
  const saved = storage.get(STORAGE_KEY, DEFAULT);
  applyTheme(saved);

  // React to OS preference changes in auto mode
  _mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  _mediaQuery.addEventListener('change', () => {
    if (getTheme() === 'auto') applyTheme('auto');
  });
}

export function getTheme() {
  return storage.get(STORAGE_KEY, DEFAULT);
}

export function setTheme(mode) {
  if (!['auto', 'light', 'dark'].includes(mode)) return;
  storage.set(STORAGE_KEY, mode);
  applyTheme(mode);
  window.dispatchEvent(new CustomEvent('themechange', { detail: { mode, effective: getEffectiveTheme() } }));
}

export function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === 'light') {
    root.setAttribute('data-theme', 'light');
  } else if (mode === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else {
    // auto — remove attribute so CSS media query takes over
    root.removeAttribute('data-theme');
  }
  // Update theme-color meta for browser chrome
  const effective = mode === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : mode;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = effective === 'dark' ? '#0f1020' : '#f7f8fb';
}

export function getEffectiveTheme() {
  const mode = getTheme();
  if (mode !== 'auto') return mode;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
