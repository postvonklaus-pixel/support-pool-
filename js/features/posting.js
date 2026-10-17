/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Video Posting
   ═══════════════════════════════════════════════════════ */

import { state }   from '../state.js';
import { t }       from '../i18n.js';
import { writeDB } from '../firebase.js';
import { toast }   from '../components/toast.js';
import { openModal, closeModal } from '../components/modal.js';
import { on }      from '../events.js';
import { goScreen } from '../router.js';
import { addNotif } from './notifications.js';

const R1_MS   = 12 * 60 * 60 * 1000;
const R1_NEED = 10;

export function openPostModal() {
  const cu = state.currentUser;
  if (!cu) return;

  const u     = state.db.members?.[cu] || {};
  const stats = u.stats || {};
  const given = stats.given    || 0;
  const recv  = stats.received || 0;
  const bal   = given - recv;
  const tot   = u.postsTotal  || 0;

  // Cooldown check
  if (u.lastPost && (Date.now() - u.lastPost) < R1_MS) {
    const rem = R1_MS - (Date.now() - u.lastPost);
    const h   = Math.floor(rem / 3600000);
    const m   = Math.floor((rem % 3600000) / 60000);
    toast(`⏳ Noch ${h}h ${m}m warten`, 'warning', 4000);
    return;
  }

  // Balance check (after first 2 videos)
  if (tot >= 2 && bal < 0) {
    toast(`❌ Balance: ${bal}. Erst ${Math.abs(bal)} Supports geben!`, 'error', 5000);
    return;
  }

  // Min time = now+1h, max = now+7d (for scheduling picker)
  const minDt = new Date(Date.now() + 3600000).toISOString().slice(0, 16);
  const maxDt = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16);

  openModal({
    id: 'post-modal',
    title: `🎬 ${t('postBtn')}`,
    body: `
      <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px">
        ${t('postModalSub')}
      </p>
      <div class="input-wrap">
        <input id="post-url-input" class="input input--lg" type="url" placeholder="https://www.tiktok.com/..." autocomplete="off">
      </div>
      <div id="post-url-error" style="color:var(--danger);font-size:12px;margin-top:6px;display:none"></div>

      <!-- Scheduling toggle -->
      <div class="post-schedule-row" style="margin-top:14px">
        <label class="post-schedule-row__label">
          <input type="checkbox" id="post-schedule-toggle"> ${t('postSchedLabel')}
        </label>
      </div>
      <div id="post-schedule-picker" style="display:none;margin-top:10px">
        <input type="datetime-local" id="post-schedule-dt" class="input"
          min="${minDt}" max="${maxDt}" style="width:100%">
        <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px">
          ${t('postSchedHint')}
        </div>
      </div>

      <button class="btn btn--primary btn--full" data-action="post:submit" style="margin-top:16px">
        ${t('postSubmit')}
      </button>
    `,
  });

  // Toggle scheduling picker
  setTimeout(() => {
    const toggle = document.getElementById('post-schedule-toggle');
    const picker = document.getElementById('post-schedule-picker');
    toggle?.addEventListener('change', () => {
      picker.style.display = toggle.checked ? '' : 'none';
    });
    document.getElementById('post-url-input')?.focus();
  }, 150);
}

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

  // Duplicate URL check — same link already in the pool
  const duplicate = Object.values(state.db.videos || {}).find(
    v => (v.link || v.url || '').trim() === url && v.status !== 'done' && v.status !== 'expired'
  );
  if (duplicate) {
    if (err) { err.textContent = t('postErrDup'); err.style.display = ''; }
    return;
  }

  const id  = `vid_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
  const u   = state.db.members?.[cu] || {};
  const now = Date.now();

  // Scheduling
  const schedToggle = document.getElementById('post-schedule-toggle');
  const schedDt     = document.getElementById('post-schedule-dt');
  const isScheduled = schedToggle?.checked && schedDt?.value;
  const scheduledFor = isScheduled ? new Date(schedDt.value).getTime() : null;

  writeDB(`videos/${id}`, {
    id, link: url, owner: cu, ownerKey: cu.toLowerCase(),
    status: isScheduled ? 'scheduled' : 'open',
    round: 1,
    r1Supporters: [], r2Supporters: [],
    r1Need: R1_NEED,
    postedAt: now,
    ...(scheduledFor ? { scheduledFor } : {}),
  });

  writeDB(`members/${cu}/lastPost`,   now);
  writeDB(`members/${cu}/postsTotal`, (u.postsTotal || 0) + 1);

  closeModal('post-modal');
  if (isScheduled) {
    const dt = new Date(scheduledFor).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
    toast(`${t('postScheduledFor')} ${dt} ⏰`, 'success', 4000);
  } else {
    toast(t('postPosted'), 'success');
  }
  setTimeout(() => goScreen('myvideos'), 800);
});

// ── Client-Side Fallback: activate scheduled videos ───────
// The Cloud Function (processScheduledVideos) is the primary poster.
// This runs on boot as a safety net in case the CF missed a run.
export function checkPendingOnBoot() {
  const cu  = state.currentUser;
  const now = Date.now();
  const videos = state.db.videos || {};

  Object.entries(videos).forEach(([vidId, v]) => {
    if (v.status !== 'scheduled')   return;
    if (!v.scheduledFor)            return;
    if (v.scheduledFor > now)       return;
    if ((v.ownerKey || v.owner) !== cu) return;

    // Activate: mark as open
    writeDB(`videos/${vidId}/status`,  'open');
    writeDB(`videos/${vidId}/postedAt`, now);

    addNotif(cu, '📹', '', 'postConfirm', { msgKey: 'schedPosted' });
    toast(t('schedPosted') || '🎉 Dein geplantes Video ist jetzt live!', 'success', 4000);
  });
}
