/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Onboarding Flow (Part J)
   3-slide full-screen overlay for first-time users
   ═══════════════════════════════════════════════════════ */

import { storage } from '../storage.js';
import { writeDB } from '../firebase.js';
import { state }   from '../state.js';

const STORAGE_KEY = 'onboarded';

const SLIDES = [
  {
    icon: '👋',
    title: 'Willkommen im NOVA Support Pool!',
    body: `
      <p>Der Pool ist eine <strong>gegenseitige TikTok-Community</strong> — du hilfst anderen, andere helfen dir.</p>
      <div class="ob-feature-list">
        <div class="ob-feature"><span>🎯</span><span>Kommentiere auf Videos deiner Mitglieder</span></div>
        <div class="ob-feature"><span>💰</span><span>Sammle Guthaben für eigene Videos</span></div>
        <div class="ob-feature"><span>🏆</span><span>Steige in Rang und Ansehen auf</span></div>
      </div>
    `,
  },
  {
    icon: '💰',
    title: 'Das Guthaben-System',
    body: `
      <div class="ob-balance-demo">
        <div class="ob-bal-row ob-bal-row--give">
          <div class="ob-bal-icon">💬</div>
          <div class="ob-bal-text">
            <div class="ob-bal-label">Du gibst einen Support</div>
            <div class="ob-bal-val ob-bal-val--plus">+1 Guthaben</div>
          </div>
        </div>
        <div class="ob-bal-row ob-bal-row--recv">
          <div class="ob-bal-icon">🎬</div>
          <div class="ob-bal-text">
            <div class="ob-bal-label">Dein Video wird supportet</div>
            <div class="ob-bal-val ob-bal-val--minus">−1 Guthaben</div>
          </div>
        </div>
      </div>
      <p class="ob-note">💡 Erst supporten, dann posten — so bleibt der Pool gesund!</p>
    `,
  },
  {
    icon: '🚀',
    title: 'Bereit loszulegen?',
    body: `
      <div class="ob-ready-list">
        <div class="ob-ready-item">
          <div class="ob-ready-check">✓</div>
          <span>Tippe im Feed auf ein Video und hinterlasse einen Kommentar</span>
        </div>
        <div class="ob-ready-item">
          <div class="ob-ready-check">✓</div>
          <span>Bestätige den Support — dein Guthaben steigt</span>
        </div>
        <div class="ob-ready-item">
          <div class="ob-ready-check">✓</div>
          <span>Sobald du genug Guthaben hast, poste dein eigenes Video</span>
        </div>
      </div>
      <p class="ob-note">🎉 Viel Erfolg — und danke, dass du Teil von NOVA bist!</p>
    `,
  },
];

let _slide  = 0;
let _el     = null;
let _touchX = 0;

export function shouldShowOnboarding(cu) {
  if (storage.get(STORAGE_KEY)) return false;
  const u = state.db.members?.[cu] || {};
  if (u.onboarded) return false;
  return true;
}

export function startOnboarding(cu) {
  _slide = 0;
  _el    = document.getElementById('onboarding-overlay');
  if (!_el) return;

  _render();
  _el.classList.add('ob--visible');

  // Swipe support
  _el.addEventListener('touchstart', _onTouchStart, { passive: true });
  _el.addEventListener('touchend',   _onTouchEnd,   { passive: true });
}

function _render() {
  if (!_el) return;
  const s    = SLIDES[_slide];
  const last = _slide === SLIDES.length - 1;

  _el.innerHTML = `
    <div class="ob-card ob-slide-in">
      <button class="ob-skip" id="ob-skip">Überspringen</button>

      <div class="ob-icon">${s.icon}</div>
      <h2 class="ob-title">${s.title}</h2>
      <div class="ob-body">${s.body}</div>

      <div class="ob-dots">
        ${SLIDES.map((_, i) =>
          `<div class="ob-dot ${i === _slide ? 'ob-dot--active' : ''}"></div>`
        ).join('')}
      </div>

      <button class="btn btn--primary btn--full ob-next" id="ob-next">
        ${last ? '🚀 Los geht\'s!' : 'Weiter →'}
      </button>
    </div>
  `;

  document.getElementById('ob-next')?.addEventListener('click', _advance);
  document.getElementById('ob-skip')?.addEventListener('click', _finish);
}

function _advance() {
  if (_slide < SLIDES.length - 1) {
    _slide++;
    _render();
  } else {
    _finish();
  }
}

function _finish() {
  if (!_el) return;
  _el.classList.remove('ob--visible');
  _el.removeEventListener('touchstart', _onTouchStart);
  _el.removeEventListener('touchend',   _onTouchEnd);

  // Mark as done
  storage.set(STORAGE_KEY, true);
  const cu = state.currentUser;
  if (cu) writeDB(`members/${cu}/onboarded`, true);
}

function _onTouchStart(e) { _touchX = e.touches[0].clientX; }
function _onTouchEnd(e) {
  const dx = e.changedTouches[0].clientX - _touchX;
  if (Math.abs(dx) < 40) return;
  if (dx < 0 && _slide < SLIDES.length - 1) { _slide++; _render(); }
  else if (dx > 0 && _slide > 0)            { _slide--; _render(); }
}
