/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Video Posting + Queue System
   ═══════════════════════════════════════════════════════ */

import { state }      from '../state.js';
import { t }          from '../i18n.js';
import { writeDB }    from '../firebase.js';
import { toast }      from '../components/toast.js';
import { openModal, closeModal } from '../components/modal.js';
import { on }         from '../events.js';
import { goScreen }   from '../router.js';
import { addNotif }   from './notifications.js';
import { getNextFridayWIB } from '../utils.js';

const R1_MS        = 12 * 60 * 60 * 1000;
const SUPER_MS     =  6 * 60 * 60 * 1000;
const SUPER_THRESH = 50;
const R1_NEED      = 10;
const BAL_LIMIT    = -10;

// ── Helpers ────────────────────────────────────────────

function _cooldownMs(u) {
  return (u.stats?.given || 0) >= SUPER_THRESH ? SUPER_MS : R1_MS;
}

function _myQueueVideos(cu) {
  return Object.entries(state.db.videos || {})
    .filter(([, v]) => {
      const o = (v.ownerKey || v.owner || '').toLowerCase();
      return o === cu.toLowerCase() && (v.status === 'open' || v.status === 'scheduled');
    })
    .map(([key, v]) => ({ ...v, _key: key }))
    .sort((a, b) => {
      const ta = a.status === 'open' ? (a.postedAt || 0) : (a.scheduledFor || 0);
      const tb = b.status === 'open' ? (b.postedAt || 0) : (b.scheduledFor || 0);
      return ta - tb;
    });
}

function _nextSlot(cu, u) {
  const cd     = _cooldownMs(u);
  const videos = _myQueueVideos(cu);
  if (!videos.length) return Date.now();
  let latest = 0;
  videos.forEach(v => {
    const base = v.status === 'scheduled' ? (v.scheduledFor || v.postedAt || 0) : (v.postedAt || 0);
    const end  = base + cd;
    if (end > latest) latest = end;
  });
  return Math.max(latest, Date.now());
}

function _fmtRem(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function _fmtDate(ts) {
  return new Date(ts).toLocaleString('de-DE', {
    weekday: 'short', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Main entry point ───────────────────────────────────

export function openPostModal() {
  const cu = state.currentUser;
  if (!cu) return;
  const u     = state.db.members?.[cu] || {};
  const queue = _myQueueVideos(cu);
  if (queue.length > 0) {
    _openQueueManager(cu, u, queue);
  } else {
    _openPostForm(cu, u, null);
  }
}

// ── Queue Manager Modal ────────────────────────────────

function _openQueueManager(cu, u, queue) {
  const now      = Date.now();
  const cd       = _cooldownMs(u);
  const reset    = getNextFridayWIB();
  const nextSlot = _nextSlot(cu, u);
  const canAdd   = nextSlot < reset;
  const isNow    = nextSlot <= now + 90000;

  const stats   = u.stats || {};
  const bal     = (stats.given || 0) - (stats.received || 0);
  const balWarn = bal <= BAL_LIMIT;

  const rows = queue.map(v => {
    const isOpen    = v.status === 'open';
    const activAt   = isOpen ? (v.postedAt || now) : (v.scheduledFor || now);
    const remaining = Math.max(0, activAt + cd - now);
    const vid       = v.id || v._key || '';
    const link      = (v.link || v.url || '');
    const shortLink = link.replace(/^https?:\/\/(www\.)?tiktok\.com\//i, '@').slice(0, 38);

    return `
    <div class="queue-row${isOpen ? ' queue-row--active' : ''}">
      <div class="queue-row__head">
        <span class="queue-row__status">${isOpen
          ? '<span class="queue-row__live">🟢 Live</span>'
          : `<span class="queue-row__sched">⏰ ${_fmtDate(v.scheduledFor || 0)}</span>`
        }</span>
        ${!isOpen && vid
          ? `<button class="btn btn--sm btn--ghost" data-action="queue:delete" data-vid="${vid}" style="padding:2px 8px;color:var(--accent-danger);font-size:12px">🗑 Löschen</button>`
          : ''}
      </div>
      <div class="queue-row__link">${shortLink}</div>
      ${remaining > 0 ? `<div class="queue-row__timer">⏳ Cooldown: ${_fmtRem(remaining)}</div>` : ''}
    </div>`;
  });

  openModal({
    id: 'queue-modal',
    title: `📹 Warteschlange (${queue.length})`,
    body: `
      ${balWarn ? `<div class="queue-bal-warn">⚠️ <strong>Guthaben: ${bal}</strong> — Gib Supports damit deine Videos live gehen!</div>` : ''}
      <div class="queue-list">${rows.join('')}</div>
      <div class="queue-reset-info">🔄 Reset: ${_fmtDate(reset)}</div>
      ${canAdd ? `
        <button class="btn btn--primary btn--full" data-action="queue:add" style="margin-top:10px">
          ${isNow ? '▶ Jetzt neues Video posten' : `+ Vormerken · ${_fmtDate(nextSlot)}`}
        </button>
      ` : `
        <div class="queue-full-msg">✅ Alle Slots bis zum Reset belegt</div>
      `}
    `,
  });
}

// ── Post Form ──────────────────────────────────────────

function _openPostForm(cu, u, slotTs) {
  const isQueue = slotTs !== null;
  const tot   = u.postsTotal || 0;
  const stats = u.stats || {};
  const bal   = (stats.given || 0) - (stats.received || 0);

  if (!isQueue && tot >= 2 && bal < 0) {
    toast(`❌ Balance: ${bal}. Erst ${Math.abs(bal)} Supports geben!`, 'error', 5000);
    return;
  }

  const minDt = new Date(Date.now() + 3600000).toISOString().slice(0, 16);
  const maxDt = new Date(getNextFridayWIB()).toISOString().slice(0, 16);

  openModal({
    id: 'post-modal',
    title: isQueue ? '⏰ Vormerken' : `🎬 ${t('postBtn')}`,
    body: `
      <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px">
        ${isQueue
          ? `Video wird automatisch am <strong>${_fmtDate(slotTs)}</strong> live gestellt.`
          : t('postModalSub')}
      </p>
      <div class="input-wrap">
        <input id="post-url-input" class="input input--lg" type="url"
          placeholder="https://www.tiktok.com/..." autocomplete="off">
      </div>
      <div id="post-url-error" style="color:var(--danger);font-size:12px;margin-top:6px;display:none"></div>
      ${!isQueue ? `
        <div class="post-schedule-row" style="margin-top:14px">
          <label class="post-schedule-row__label">
            <input type="checkbox" id="post-schedule-toggle"> ${t('postSchedLabel')}
          </label>
        </div>
        <div id="post-schedule-picker" style="display:none;margin-top:10px">
          <input type="datetime-local" id="post-schedule-dt" class="input"
            min="${minDt}" max="${maxDt}" style="width:100%">
          <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px">${t('postSchedHint')}</div>
        </div>
      ` : `<input type="hidden" id="post-queue-slot" value="${slotTs}">`}
      <button class="btn btn--primary btn--full" data-action="post:submit" style="margin-top:16px">
        ${isQueue ? (t('postSubmitQueue') || '✓ Vormerken') : t('postSubmit')}
      </button>
    `,
  });

  setTimeout(() => {
    if (!isQueue) {
      const toggle = document.getElementById('post-schedule-toggle');
      const picker = document.getElementById('post-schedule-picker');
      toggle?.addEventListener('change', () => {
        picker.style.display = toggle.checked ? '' : 'none';
      });
    }
    document.getElementById('post-url-input')?.focus();
  }, 150);
}

// ── Queue: Add ─────────────────────────────────────────

on('queue:add', () => {
  const cu = state.currentUser;
  if (!cu) return;
  const u     = state.db.members?.[cu] || {};
  const slot  = _nextSlot(cu, u);
  const isNow = slot <= Date.now() + 90000;
  closeModal('queue-modal');
  setTimeout(() => _openPostForm(cu, u, isNow ? null : slot), 200);
});

// ── Queue: Delete ──────────────────────────────────────

on('queue:delete', (el) => {
  const vidId = el.dataset.vid;
  if (!vidId) return;
  writeDB(`videos/${vidId}`, null);
  if (state.db.videos?.[vidId]) delete state.db.videos[vidId];
  closeModal('queue-modal');
  toast('🗑 Video aus Warteschlange entfernt', 'info', 2500);
  setTimeout(() => {
    const cu = state.currentUser;
    if (!cu) return;
    const u     = state.db.members?.[cu] || {};
    const queue = _myQueueVideos(cu);
    if (queue.length > 0) _openQueueManager(cu, u, queue);
  }, 350);
});

// ── Post: Submit ───────────────────────────────────────

on('post:submit', () => {
  const input = document.getElementById('post-url-input');
  const url   = (input?.value || '').trim();
  const err   = document.getElementById('post-url-error');

  if (!url || !url.includes('tiktok.com')) {
    if (err) { err.textContent = t('postErrLink'); err.style.display = ''; }
    return;
  }

  const cu = state.currentUser;
  if (!cu) return;

  const duplicate = Object.values(state.db.videos || {}).find(
    v => (v.link || v.url || '').trim() === url && v.status !== 'done' && v.status !== 'expired'
  );
  if (duplicate) {
    if (err) { err.textContent = t('postErrDup'); err.style.display = ''; }
    return;
  }

  const id  = `vid_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const u   = state.db.members?.[cu] || {};
  const now = Date.now();

  // Determine if this is a queue slot or manual schedule
  const queueSlotEl = document.getElementById('post-queue-slot');
  const schedToggle = document.getElementById('post-schedule-toggle');
  const schedDt     = document.getElementById('post-schedule-dt');

  let scheduledFor = null;
  if (queueSlotEl) {
    scheduledFor = parseInt(queueSlotEl.value, 10) || null;
  } else if (schedToggle?.checked && schedDt?.value) {
    scheduledFor = new Date(schedDt.value).getTime() || null;
  }

  const isScheduled = scheduledFor !== null && scheduledFor > now + 30000;

  writeDB(`videos/${id}`, {
    id, link: url, owner: cu, ownerKey: cu,
    status: isScheduled ? 'scheduled' : 'open',
    round: 1,
    r1Supporters: [], r2Supporters: [],
    r1Need: R1_NEED,
    postedAt: now,
    ...(isScheduled ? { scheduledFor } : {}),
  });

  if (!isScheduled) writeDB(`members/${cu}/lastPost`, now);
  writeDB(`members/${cu}/postsTotal`, (u.postsTotal || 0) + 1);

  closeModal('post-modal');
  if (isScheduled) {
    toast(`${t('postScheduledFor') || '📅 Geplant für'} ${_fmtDate(scheduledFor)} ⏰`, 'success', 4000);
  } else {
    toast(t('postPosted'), 'success');
    setTimeout(() => goScreen('myvideos'), 800);
  }
});

// ── Scheduled Video Activation ─────────────────────────

export function checkPendingOnBoot() {
  checkScheduledVideos();
}

export function checkScheduledVideos() {
  const cu  = state.currentUser;
  if (!cu) return;
  const now    = Date.now();
  const videos = state.db.videos || {};

  Object.entries(videos).forEach(([vidId, v]) => {
    if (v.status !== 'scheduled') return;
    if (!v.scheduledFor)          return;
    if (v.scheduledFor > now)     return;

    const owner      = v.ownerKey || v.owner;
    const ownerData  = state.db.members?.[owner] || {};
    const ownerStats = ownerData.stats || {};
    const bal        = (ownerStats.given || 0) - (ownerStats.received || 0);
    const total      = ownerData.postsTotal || 0;

    // Balance gate: auto-delete if owner is below limit (after 2+ videos)
    if (total >= 2 && bal <= BAL_LIMIT) {
      writeDB(`videos/${vidId}`, null);
      if (owner) addNotif(owner, '⚠️', '', '', { msgKey: 'queueBalanceDel' });
      if (owner === cu) toast(t('queueBalanceDel') || '⚠️ Video gelöscht — Guthaben zu niedrig!', 'warning', 5000);
      return;
    }

    writeDB(`videos/${vidId}/status`,  'open');
    writeDB(`videos/${vidId}/postedAt`, now);
    if (owner) writeDB(`members/${owner}/lastPost`, now);

    if (owner) addNotif(owner, '📹', '', 'postConfirm', { msgKey: 'schedPosted' });
    if (owner === cu) toast(t('schedPosted') || '🎉 Dein geplantes Video ist jetzt live!', 'success', 4000);
  });
}
