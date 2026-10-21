/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Support Flow (Part I Redesign)
   ═══════════════════════════════════════════════════════ */

import { state }   from '../state.js';
import { t }       from '../i18n.js';
import { esc, openUrl } from '../utils.js';
import { writeDB } from '../firebase.js';
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
let _videoLink   = '';   // saved so copyComment can re-open TikTok

export function handleSupport(vidId) {
  if (!vidId) return;
  const v = _findVideo(vidId);
  if (!v) { toast('Video nicht gefunden', 'error'); return; }

  // Daily support cap: 20 base, 40 if user has an active video in pool
  const cu = state.currentUser;
  if (cu) {
    const todayKey  = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
    const givenToday = state.db.members?.[cu]?.todayGiven?.[todayKey] || 0;
    if (givenToday >= 20) {
      const hasOpenVideo = Object.values(state.db.videos || {}).some(
        vid => (vid.ownerKey === cu || vid.owner === cu) && vid.status === 'open'
      );
      if (!hasOpenVideo) {
        toast(t('supportDailyLimit') || 'Max. 20 Supports heute — poste ein Video für mehr!', 'warning', 4000);
        return;
      }
      if (givenToday >= 40) {
        toast(t('supportDailyMax') || 'Tageslimit: 40 Supports erreicht.', 'warning', 4000);
        return;
      }
    }
  }

  _copied      = false;
  _videoOpened = false;
  _videoLink   = v.link || v.url || '';

  const cu   = state.currentUser;
  const link = v.link || v.url || '#';
  const lang = state.lang;
  const pool = _getCommentPool(lang);
  const owner = fbDec(v.ownerKey || v.owner || '?');
  const r1    = (v.r1Supporters || []).length;
  const r1n   = v.r1Need || state.db.settings?.r1Need || 10;
  const slotsLeft = r1n - r1;
  const urgent = slotsLeft <= 3 && slotsLeft > 0;

  openModal({
    id:    'support-modal',
    title: '',
    body:  _buildStep1(vidId, link, pool, owner, slotsLeft, urgent),
  });
}

function _buildStep1(vidId, link, pool, owner, slotsLeft, urgent) {
  return `
    <div class="sf-modal" id="sf-modal">
      <!-- Header -->
      <div class="sf-header">
        <div class="sf-header__owner">@${esc(owner)}</div>
        ${urgent ? `<span class="sf-urgent-badge">⚡ ${slotsLeft} Slot${slotsLeft === 1 ? '' : 's'}!</span>` : ''}
      </div>

      <!-- Step indicators -->
      <div class="sf-steps">
        <div class="sf-step sf-step--active" id="sf-s1">
          <div class="sf-step__dot">1</div>
          <div class="sf-step__label">${t('sfStep1')}</div>
        </div>
        <div class="sf-steps__line"></div>
        <div class="sf-step" id="sf-s2">
          <div class="sf-step__dot">2</div>
          <div class="sf-step__label">${t('sfStep2')}</div>
        </div>
        <div class="sf-steps__line"></div>
        <div class="sf-step" id="sf-s3">
          <div class="sf-step__dot">3</div>
          <div class="sf-step__label">${t('sfStep3')}</div>
        </div>
      </div>

      <!-- Step 1: Open video -->
      <div class="sf-body" id="sf-body-1">
        <p class="sf-inst">${t('sfInst1')}</p>
        <a class="btn btn--primary btn--full sf-open-btn"
           href="${esc(link)}" target="_blank" rel="noopener"
           data-action="support:video-opened" data-vid="${esc(vidId)}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          ${t('sfOpenBtn')}
        </a>
      </div>

      <!-- Step 2: Choose comment -->
      <div class="sf-body hidden" id="sf-body-2">
        <p class="sf-inst">${t('sfInst2')}</p>
        <div class="sf-comments">
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

      <!-- Step 3: Confirm -->
      <div class="sf-body hidden" id="sf-body-3">
        <div class="sf-confirm-icon">✅</div>
        <p class="sf-inst">${t('sfInst3')}</p>
        <button class="btn btn--success btn--full sf-done-btn"
          data-action="support:done" data-vid="${esc(vidId)}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          ${t('sfDoneBtn')}
        </button>
        <button class="btn btn--ghost btn--full" style="margin-top:8px"
          data-action="support:back">
          ${t('sfBack')}
        </button>
      </div>
    </div>
  `;
}

export function copyComment(comment) {
  if (!comment) return;

  const _afterCopy = () => {
    _copied = true;
    // Re-open TikTok so user can paste the comment immediately
    if (_videoLink && _videoLink !== '#') {
      openUrl(_videoLink);
    }
    _advanceToStep3();
    const hint = document.getElementById('sf-copy-hint');
    if (hint) hint.classList.remove('hidden');
    const btns = document.querySelectorAll('.sf-comment-btn');
    btns.forEach(b => {
      if (b.dataset.comment === comment) {
        b.classList.add('sf-comment-btn--copied');
        b.querySelector('.sf-comment-btn__icon').textContent = '✅';
      }
    });
  };

  navigator.clipboard?.writeText(comment)
    .then(_afterCopy)
    .catch(() => {
      // Clipboard API blocked — show comment text so user can copy manually
      toast('📋 ' + comment, 'info', 8000);
      _afterCopy();
    });
}

function _advanceToStep3() {
  _setStep(2, 3);
  // activate step 3 dot
  const s3 = document.getElementById('sf-s3');
  if (s3) s3.classList.add('sf-step--active');
}

on('support:video-opened', (el) => {
  // events.js calls e.preventDefault() on all data-action clicks, which
  // blocks the <a href> from navigating. Open the link manually instead.
  const link = el.getAttribute('href') || el.dataset.link;
  if (link && link !== '#') openUrl(link);

  _videoOpened = true;
  _setStep(1, 2);
  const s2 = document.getElementById('sf-s2');
  if (s2) s2.classList.add('sf-step--active');
  const s1 = document.getElementById('sf-s1');
  if (s1) s1.classList.add('sf-step--done');
});

on('support:back', () => {
  _setStep(3, 2);
});

on('support:done', (el) => {
  const vidId = el.dataset.vid;
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

  writeDB(`videos/${dbVidId}/${field}`, newSups);

  // Advance to round 2 when R1 is now full
  if (rnd === 1 && newSups.length >= r1n) {
    writeDB(`videos/${dbVidId}/round`, 2);
  }

  // Optimistic local state update so feed re-renders immediately
  if (state.db.videos?.[dbVidId]) {
    state.db.videos[dbVidId][field] = newSups;
    if (rnd === 1 && newSups.length >= r1n) state.db.videos[dbVidId].round = 2;
  }

  // Supporter stats
  const u = state.db.members?.[cu] || {};
  const stats = u.stats || {};
  const newGiven = (stats.given || 0) + 1;
  writeDB(`members/${cu}/stats/given`, newGiven);
  writeDB(`members/${cu}/weeklyGiven`,  (u.weeklyGiven || 0) + 1);

  const today = new Date().toISOString().slice(0, 10);
  const days  = [...new Set([...(u.supportDays || []), today])];
  writeDB(`members/${cu}/supportDays`, days);

  const todayKey = today.replace(/-/g, '_');
  const newTodayGiven = (u.todayGiven?.[todayKey] || 0) + 1;
  writeDB(`members/${cu}/todayGiven/${todayKey}`, newTodayGiven);

  // Optimistic local state update for member stats so counters render immediately
  if (state.db.members?.[cu]) {
    if (!state.db.members[cu].stats) state.db.members[cu].stats = {};
    state.db.members[cu].stats.given = newGiven;
    state.db.members[cu].weeklyGiven = (u.weeklyGiven || 0) + 1;
    state.db.members[cu].supportDays = days;
    if (!state.db.members[cu].todayGiven) state.db.members[cu].todayGiven = {};
    state.db.members[cu].todayGiven[todayKey] = newTodayGiven;
  }

  // Increment owner's received counter.
  // ownerKey was historically stored lowercase — resolve to the real member key.
  let owner = v.ownerKey || v.owner || '';
  if (owner && !state.db.members?.[owner]) {
    const match = Object.keys(state.db.members || {}).find(
      k => k.toLowerCase() === owner.toLowerCase()
    );
    if (match) owner = match;
  }
  if (owner && owner !== cu) {
    const ownerData  = state.db.members?.[owner] || {};
    const ownerStats = ownerData.stats || {};
    writeDB(`members/${owner}/stats/received`, (ownerStats.received || 0) + 1);

    const senderName = state.db.members?.[cu]?.name || fbDec(cu);
    addNotif(owner, '💬', '', 'support', {
      from: cu,
      msgKey: 'supportMsg',
      params: { from: senderName },
    });
  }

  closeModal('support-modal');
  confetti();
  toast(t('sfSuccess'), 'success');

  // Re-render feed immediately with the optimistic state update
  import('../router.js').then(m => m.renderActive());

  // Check achievements after a brief delay (so DB write propagates to state)
  setTimeout(() => checkAchievements(cu), 600);
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
