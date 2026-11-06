/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Support Flow
   ═══════════════════════════════════════════════════════ */

import { state }   from '../state.js';
import { t }       from '../i18n.js';
import { esc, openUrl } from '../utils.js';
import { writeDB, getAuthUser } from '../firebase.js';
import { toast }   from '../components/toast.js';
import { openModal, closeModal } from '../components/modal.js';
import { confetti } from '../components/confetti.js';
import { on }      from '../events.js';
import { checkAchievements } from './achievements.js';
import { TEMPLATES } from './adminTemplates.js';
import { addNotif } from './notifications.js';
import { fbDec } from '../utils.js';

function _getCommentPool(lang) {
  const custom   = state.db.settings?.tplLibrary || {};
  const defaults = TEMPLATES[lang] || TEMPLATES.de;
  return defaults.map((def, i) => custom[i] ?? def);
}

const _LOCALE_MAP = { de:'de-DE', en:'en-GB', id:'id-ID', it:'it-IT', es:'es-ES', tr:'tr-TR', ar:'ar-SA', zh:'zh-CN', ja:'ja-JP', pl:'pl-PL' };

function _fillPlaceholders(text, owner) {
  const cu     = state.currentUser || '';
  const u      = state.db.members?.[cu] || {};
  const member = u.name || fbDec(cu);
  const gruppe = u.group || '';
  const locale = _LOCALE_MAP[state.lang] || 'de-DE';
  const now    = new Date();
  return text
    .replace(/\{member\}/g, member)
    .replace(/\{name\}/g,   owner)
    .replace(/\{gruppe\}/g, gruppe)
    .replace(/\{date\}/g,   now.toLocaleDateString(locale))
    .replace(/\{time\}/g,   now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }));
}

let _copied      = false;
let _videoOpened = false;
let _videoLink   = '';
let _currentVidId = '';

export function handleSupport(vidId) {
  if (!vidId) return;
  const v = _findVideo(vidId);
  if (!v) { toast('Video nicht gefunden', 'error'); return; }

  if (!_checkDailyLimit()) return;

  _copied       = false;
  _videoOpened  = false;
  _videoLink    = v.link || v.url || '';
  _currentVidId = vidId;

  const link  = v.link || v.url || '#';
  const lang  = state.lang;
  const pool  = _getCommentPool(lang);
  const owner = fbDec(v.ownerKey || v.owner || '?');
  const r1n   = v.r1Need || state.db.settings?.r1Need || 10;
  const r1    = (v.r1Supporters || []).length;
  const slotsLeft = r1n - r1;
  const urgent = slotsLeft <= 3 && slotsLeft > 0;

  openModal({
    id:    'support-modal',
    title: '',
    body:  _buildModal(vidId, link, pool, owner, slotsLeft, urgent),
  });
}

// Called from vpm:support — TikTok is already opened by the preview modal CTA.
// Opens the support modal directly at Step 2 (skip Step 1).
export function handleSupportStep2(vidId) {
  if (!vidId) return;
  const v = _findVideo(vidId);
  if (!v) { toast('Video nicht gefunden', 'error'); return; }

  if (!_checkDailyLimit()) return;

  _copied       = false;
  _videoOpened  = true;
  _videoLink    = v.link || v.url || '';
  _currentVidId = vidId;

  const link  = v.link || v.url || '#';
  const lang  = state.lang;
  const pool  = _getCommentPool(lang);
  const owner = fbDec(v.ownerKey || v.owner || '?');
  const r1n   = v.r1Need || state.db.settings?.r1Need || 10;
  const r1    = (v.r1Supporters || []).length;
  const slotsLeft = r1n - r1;
  const urgent = slotsLeft <= 3 && slotsLeft > 0;

  openModal({
    id:    'support-modal',
    title: '',
    body:  _buildModal(vidId, link, pool, owner, slotsLeft, urgent, 2),
  });
}

function _checkDailyLimit() {
  const cu = state.currentUser;
  if (!cu) return true;
  const todayKey    = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
  const givenToday  = state.db.members?.[cu]?.todayGiven?.[todayKey] || 0;
  if (givenToday >= 20) {
    const hasOpenVideo = Object.values(state.db.videos || {}).some(
      vid => (vid.ownerKey === cu || vid.owner === cu) && vid.status === 'open'
    );
    if (!hasOpenVideo) {
      toast(t('supportDailyLimit') || 'Max. 20 Supports heute — poste ein Video für mehr!', 'warning', 4000);
      return false;
    }
    if (givenToday >= 40) {
      toast(t('supportDailyMax') || 'Tageslimit: 40 Supports erreicht.', 'warning', 4000);
      return false;
    }
  }
  return true;
}

function _buildModal(vidId, link, pool, owner, slotsLeft, urgent, startStep = 1) {
  const step1Active = startStep === 1 ? ' sf-step--active' : ' sf-step--done';
  const step2Active = startStep === 2 ? ' sf-step--active' : '';
  return `
    <div class="sf-modal" id="sf-modal">
      <div class="sf-header">
        <div class="sf-header__owner">@${esc(owner)}</div>
        ${urgent ? `<span class="sf-urgent-badge">⚡ ${slotsLeft} Slot${slotsLeft === 1 ? '' : 's'}!</span>` : ''}
      </div>

      <div class="sf-steps">
        <div class="sf-step${step1Active}" id="sf-s1">
          <div class="sf-step__dot">1</div>
          <div class="sf-step__label">${t('sfStep1')}</div>
        </div>
        <div class="sf-steps__line"></div>
        <div class="sf-step${step2Active}" id="sf-s2">
          <div class="sf-step__dot">2</div>
          <div class="sf-step__label">${t('sfStep2')}</div>
        </div>
      </div>

      <!-- Step 1: Open video -->
      <div class="sf-body${startStep !== 1 ? ' hidden' : ''}" id="sf-body-1">
        <p class="sf-inst">${t('sfInst1')}</p>
        <a class="btn btn--primary btn--full sf-open-btn"
           href="${esc(link)}" target="_blank" rel="noopener"
           data-action="support:video-opened" data-vid="${esc(vidId)}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          ${t('sfOpenBtn')}
        </a>
      </div>

      <!-- Step 2: Choose comment — clicking any option registers support immediately -->
      <div class="sf-body${startStep !== 2 ? ' hidden' : ''}" id="sf-body-2">
        <p class="sf-inst">${t('sfInst2')}</p>
        <div class="sf-comments">
          <button class="sf-comment-btn sf-comment-btn--skip" data-action="support:skip-comment">
            <span class="sf-comment-btn__txt">${t('sfSkipComment') || '✅ Support fertig — ohne Kommentar'}</span>
          </button>
          ${pool.map((c, i) => {
            const filled = _fillPlaceholders(c, owner);
            return `
            <button class="sf-comment-btn" data-action="support:copy" data-comment="${esc(filled)}" data-idx="${i}">
              <span class="sf-comment-btn__txt">${esc(filled)}</span>
              <span class="sf-comment-btn__icon">📋</span>
            </button>`;
          }).join('')}
        </div>
        <div class="sf-copy-hint hidden" id="sf-copy-hint">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          ${t('sfCopyHint')}
        </div>
      </div>
    </div>
  `;
}

// Skip comment: register support immediately
export function skipComment() {
  _doSupport(_currentVidId);
}

// Copy comment: copy + re-open TikTok + register support immediately
export function copyComment(comment) {
  if (!comment) return;

  const _afterCopy = () => {
    _copied = true;
    if (_videoLink && _videoLink !== '#') openUrl(_videoLink);
    // Visual feedback on the button
    const btns = document.querySelectorAll('.sf-comment-btn');
    btns.forEach(b => {
      if (b.dataset.comment === comment) {
        b.classList.add('sf-comment-btn--copied');
        b.querySelector('.sf-comment-btn__icon').textContent = '✅';
      }
    });
    const hint = document.getElementById('sf-copy-hint');
    if (hint) hint.classList.remove('hidden');
    // Brief delay so the ✅ feedback is visible before modal closes
    setTimeout(() => _doSupport(_currentVidId), 400);
  };

  navigator.clipboard?.writeText(comment)
    .then(_afterCopy)
    .catch(() => {
      toast('📋 ' + comment, 'info', 8000);
      _afterCopy();
    });
}

// Core support logic — called by skipComment and copyComment
function _doSupport(vidId) {
  if (!vidId) return;
  const cu = state.currentUser;
  if (!cu) return;

  const v = _findVideo(vidId);
  if (!v) return;

  const rnd    = v.round || 1;
  const field  = rnd === 1 ? 'r1Supporters' : 'r2Supporters';
  const cuLow  = cu.toLowerCase();
  const supporters = (rnd === 1 ? v.r1Supporters : v.r2Supporters) || [];

  if (supporters.map(k => k.toLowerCase()).includes(cuLow)) {
    toast(t('sfAlready'), 'warning');
    closeModal('support-modal');
    return;
  }

  const newSups = [...supporters, cu];
  const dbVidId = _findVideoId(vidId);
  const r1n     = v.r1Need || state.db.settings?.r1Need || 10;

  if (!getAuthUser()) {
    toast('⚠️ Kein Auth-Token — Support wird lokal gespeichert, aber nicht in Firebase', 'warning', 6000);
  }

  writeDB(`videos/${dbVidId}/${field}`, newSups);
  if (rnd === 1 && newSups.length >= r1n) {
    writeDB(`videos/${dbVidId}/round`, 2);
  }

  if (state.db.videos?.[dbVidId]) {
    state.db.videos[dbVidId][field] = newSups;
    if (rnd === 1 && newSups.length >= r1n) state.db.videos[dbVidId].round = 2;
  }

  const u = state.db.members?.[cu] || {};
  const stats = u.stats || {};
  const newGiven = (stats.given || 0) + 1;
  writeDB(`members/${cu}/stats/given`, newGiven);
  writeDB(`members/${cu}/weeklyGiven`,  (u.weeklyGiven || 0) + 1);

  const today  = new Date().toISOString().slice(0, 10);
  const days   = [...new Set([...(u.supportDays || []), today])];
  writeDB(`members/${cu}/supportDays`, days);

  const todayKey      = today.replace(/-/g, '_');
  const newTodayGiven = (u.todayGiven?.[todayKey] || 0) + 1;
  writeDB(`members/${cu}/todayGiven/${todayKey}`, newTodayGiven);

  const currentStreak = (() => {
    let n = 0; const d = new Date();
    while (days.includes(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  })();
  const newRecord = Math.max(currentStreak, u.streakRecord || 0);
  if (newRecord > (u.streakRecord || 0)) {
    writeDB(`members/${cu}/streakRecord`, newRecord);
  }

  if (state.db.members?.[cu]) {
    if (!state.db.members[cu].stats) state.db.members[cu].stats = {};
    state.db.members[cu].stats.given        = newGiven;
    state.db.members[cu].weeklyGiven        = (u.weeklyGiven || 0) + 1;
    state.db.members[cu].supportDays        = days;
    if (!state.db.members[cu].todayGiven) state.db.members[cu].todayGiven = {};
    state.db.members[cu].todayGiven[todayKey] = newTodayGiven;
    if (newRecord > (u.streakRecord || 0)) state.db.members[cu].streakRecord = newRecord;
  }

  let owner = v.ownerKey || v.owner || '';
  if (owner && !state.db.members?.[owner]) {
    const match = Object.keys(state.db.members || {}).find(k => k.toLowerCase() === owner.toLowerCase());
    if (match) owner = match;
  }
  if (owner && owner !== cu) {
    const ownerData  = state.db.members?.[owner] || {};
    const ownerStats = ownerData.stats || {};
    writeDB(`members/${owner}/stats/received`, (ownerStats.received || 0) + 1);
    const senderName = state.db.members?.[cu]?.name || fbDec(cu);
    addNotif(owner, '💬', '', 'support', {
      from: cu, msgKey: 'supportMsg', params: { from: senderName },
    });
  }

  closeModal('support-modal');
  confetti();
  toast(t('sfSuccess'), 'success');
  import('../router.js').then(m => m.renderActive());
  setTimeout(() => checkAchievements(cu), 600);
}

on('support:video-opened', (el) => {
  const link = el.getAttribute('href') || el.dataset.link;
  if (link && link !== '#') openUrl(link);

  _videoOpened = true;
  _setStep(1, 2);
  const s2 = document.getElementById('sf-s2');
  if (s2) s2.classList.add('sf-step--active');
  const s1 = document.getElementById('sf-s1');
  if (s1) { s1.classList.remove('sf-step--active'); s1.classList.add('sf-step--done'); }
});

on('support:back', () => {
  _setStep(2, 1);
  const s1 = document.getElementById('sf-s1');
  if (s1) { s1.classList.remove('sf-step--done'); s1.classList.add('sf-step--active'); }
  const s2 = document.getElementById('sf-s2');
  if (s2) s2.classList.remove('sf-step--active');
});

// ── Helpers ────────────────────────────────────────────────
function _setStep(from, to) {
  const body = (n) => document.getElementById(`sf-body-${n}`);
  if (body(from)) body(from).classList.add('hidden');
  if (body(to))   body(to).classList.remove('hidden');
}

function _findVideo(vidId) {
  return Object.values(state.db.videos || {}).find(v =>
    v.id === vidId || v.link === vidId || v.url === vidId
  );
}

function _findVideoId(vidId) {
  const entry = Object.entries(state.db.videos || {}).find(([, v]) =>
    v.id === vidId || v.link === vidId || v.url === vidId
  );
  return entry ? entry[0] : vidId;
}
