/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Offline Detection (Part M)
   ═══════════════════════════════════════════════════════ */

let _banner = null;
let _online = navigator.onLine;

export function initOffline() {
  _banner = document.getElementById('offline-banner');
  window.addEventListener('online',  _handleOnline);
  window.addEventListener('offline', _handleOffline);
  if (!navigator.onLine) _handleOffline();
}

export function isOnline() { return _online; }

function _handleOnline() {
  _online = true;
  if (!_banner) return;
  _banner.classList.remove('offline-banner--visible');
  _banner.setAttribute('aria-hidden', 'true');
}

function _handleOffline() {
  _online = false;
  if (!_banner) return;
  _banner.classList.add('offline-banner--visible');
  _banner.setAttribute('aria-hidden', 'false');
}
