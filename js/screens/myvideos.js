/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — My Videos Screen
   ═══════════════════════════════════════════════════════ */

import { state }    from '../state.js';
import { t }        from '../i18n.js';
import { esc, timeAgo } from '../utils.js';
import { renderNotification } from '../features/notifications.js';
import { on }       from '../events.js';
import { writeDB }  from '../firebase.js';
import { toast }    from '../components/toast.js';
import { confirm }  from '../components/modal.js';
import { progressRing } from '../components/progress.js';

const R1_NEED = 10;
const R2_NEED = 10;

export function render() {
  const el = document.getElementById('screen-myvideos');
  if (!el) return;

  const cu = state.currentUser;
  if (!cu || !state.db.members?.[cu]) return;

  const u      = state.db.members[cu];
  const myKey  = cu.toLowerCase();
  const myVids = Object.values(state.db.videos || {}).filter(v =>
    (v.ownerKey || v.owner || '').toLowerCase() === myKey
  ).sort((a, b) => (b.postedAt || b.ts || 0) - (a.postedAt || a.ts || 0));

  const header = `
    <div class="page-header">
      <div class="page-header__title">${t('myVidsTile') || '🎞️ Meine Videos'}</div>
      ${myVids.length > 0 ? `
        <button class="btn btn--primary btn--sm" data-action="post:open">
          + ${t('postBtn') || 'Video posten'}
        </button>` : ''}
    </div>`;

  const notifs = _getNotifs(cu);
  const unread = notifs.filter(n => !n.read).length;

  el.innerHTML = header + `
    <div class="myvids-scroll">
      ${_renderStatusCard(myVids)}
      ${notifs.length ? _renderNotifSection(notifs, cu) : ''}
      ${!myVids.length ? `
        <div class="myvids-empty-hero">
          <div class="myvids-empty-hero__icon">🎬</div>
          <div class="myvids-empty-hero__title">${t('noMy') || 'Noch kein Video gepostet'}</div>
          <div class="myvids-empty-hero__sub">${t('mvFirstSub') || 'Poste dein erstes Video!'}</div>
          <button class="btn btn--primary myvids-empty-hero__btn" data-action="post:open">
            🎬 ${t('postBtn') || 'Erstes Video posten'}
          </button>
          <div class="myvids-how-card">
            <div class="myvids-how-step">
              <div class="myvids-how-step__num">1</div>
              <div class="myvids-how-step__text">${t('howStep1')}</div>
            </div>
            <div class="myvids-how-step">
              <div class="myvids-how-step__num">2</div>
              <div class="myvids-how-step__text">${t('howStep2')}</div>
            </div>
            <div class="myvids-how-step">
              <div class="myvids-how-step__num">3</div>
              <div class="myvids-how-step__text">${t('howStep3')}</div>
            </div>
          </div>
        </div>
      ` : myVids.map(v => _vidCard(v)).join('')}
    </div>
  `;

  _registerHandlers();
  _startExpiryTimer();
}

// ── Status-Card (B2.3) ─────────────────────────────────────
function _renderStatusCard(vids) {
  const active = vids.find(v => v.status !== 'done' && v.status !== 'expired');
  if (!active) return '';
  const r1  = (active.r1Supporters || []).length;
  const r1n = active.r1Need || R1_NEED;
  const pct = Math.min(100, Math.round((r1 / r1n) * 100));
  const link = active.link || active.url || '#';

  return `
    <div class="myvid-status-card card--glass">
      <div class="myvid-status-card__ring">
        ${progressRing(r1, r1n, { label: `${pct}%`, size: 80, stroke: 7, color: 'var(--accent-primary)' })}
      </div>
      <div class="myvid-status-card__body">
        <div class="myvid-status-card__title">🎬 ${t('activeVid')} · R${active.round || 1}</div>
        <div class="myvid-status-card__link">${esc(link.replace(/^https?:\/\/(www\.)?/,'').slice(0,36))}</div>
        <div class="myvid-status-card__prog">${r1} ${t('notifFrom')} ${r1n} ${t('statusCardSup')}</div>
      </div>
    </div>`;
}

// ── Notifications (support-type only) ─────────────────────
function _getNotifs(cu) {
  const msgs = state.db.messages || {};
  return Object.entries(msgs)
    .filter(([, m]) => (m.to === cu || m.recipient === cu) && m.type === 'notif')
    .sort(([, a], [, b]) => (b.ts || 0) - (a.ts || 0))
    .slice(0, 15)
    .map(([id, m]) => ({ ...m, _id: id }));
}

function _renderNotifSection(notifs, cu) {
  const unread = notifs.filter(n => !n.read).length;
  const userLang = state.db.members?.[cu]?.lang || state.lang;
  return `
    <div class="myvid-notif-section">
      <div class="myvid-notif-section__head">
        <span class="myvid-notif-section__title">
          🔔 ${t('notifs')}${unread > 0 ? ` <span class="notif-pip">${unread}</span>` : ''}
        </span>
        <button class="btn btn--ghost btn--sm" data-action="myvid:notif:clear">${t('notifsDelAll')}</button>
      </div>
      ${notifs.map(n => `
        <div class="myvid-notif-item${n.read ? '' : ' myvid-notif-item--unread'}" data-notif-id="${esc(n._id)}">
          <div class="myvid-notif-item__icon">${n.icon || '🔔'}</div>
          <div class="myvid-notif-item__body">
            <div class="myvid-notif-item__text">${esc(renderNotification(n, userLang))}</div>
            <div class="myvid-notif-item__meta">${n.ts ? timeAgo(n.ts) : ''}</div>
          </div>
        </div>
      `).join('')}
    </div>`;
}

function _vidCard(v) {
  const r1   = (v.r1Supporters || []).length;
  const r2   = (v.r2Supporters || []).length;
  const r1n  = v.r1Need || R1_NEED;
  const pct1 = Math.min(100, Math.round((r1 / r1n) * 100));
  const pct2 = Math.min(100, Math.round((r2 / R2_NEED) * 100));
  const isDone      = v.status === 'done';
  const isScheduled = v.status === 'scheduled' && (v.scheduledFor || 0) > Date.now();
  const link = v.link || v.url || '#';
  const schedLabel = isScheduled
    ? new Date(v.scheduledFor).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
    : null;

  const postedTs  = v.postedAt || v.ts || 0;
  const postedFmt = postedTs ? new Date(postedTs).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';
  const expiresTs = v.expiresR1 || 0;

  return `<div class="card card--glass myvid-card" data-vid-id="${esc(v.id || '')}">
    <div class="myvid-card__header">
      <a href="${esc(link)}" target="_blank" rel="noopener" class="myvid-card__link">
        🔗 ${esc(link.replace(/^https?:\/\/(www\.)?/, '').slice(0,40))}
      </a>
      <span class="badge ${isDone ? 'badge--success' : isScheduled ? 'badge--warning' : 'badge--primary'}">
        ${isDone ? t('mvDone') : isScheduled ? `⏰ ${schedLabel}` : `R${v.round || 1}`}
      </span>
    </div>
    <div class="myvid-card__timing">
      ${postedFmt ? `<span>📅 ${t('posted') || 'Gepostet'}: ${postedFmt}</span>` : ''}
      ${isDone
        ? `<span>✅ ${t('doneLabel') || 'Abgeschlossen'}</span>`
        : expiresTs
          ? `<span>⏰ ${t('expiresAt') || 'Läuft ab'}: <span class="myvid-expires" data-expires="${expiresTs}">${_renderTimeLeft(expiresTs)}</span></span>`
          : ''
      }
    </div>
    <div class="myvid-card__progress">
      <div class="myvid-card__prog-label">R1 <span>${r1}/${r1n}</span></div>
      <div class="progress-bar"><div class="progress-bar__fill" style="width:${pct1}%"></div></div>
    </div>
    ${(v.round || 1) >= 2 ? `
    <div class="myvid-card__progress">
      <div class="myvid-card__prog-label">R2 <span>${r2}/${R2_NEED}</span></div>
      <div class="progress-bar"><div class="progress-bar__fill" style="width:${pct2}%"></div></div>
    </div>` : ''}
    <div class="myvid-card__actions">
      <button class="btn btn--ghost btn--sm" data-action="myvid:copy" data-link="${esc(link)}">
        📋 ${t('mvCopy')}
      </button>
      ${!isDone ? `<button class="btn btn--danger btn--sm" data-action="myvid:delete" data-vid-id="${esc(v.id || '')}">
        🗑 ${t('mvDelete')}
      </button>` : ''}
    </div>
  </div>`;
}

function _renderTimeLeft(expiresAt) {
  const diff = Math.max(0, expiresAt - Date.now());
  if (!diff) return t('expired') || 'Abgelaufen';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h}h ${m}m ${s}s`;
}

let _expiryTimer = null;

function _startExpiryTimer() {
  clearInterval(_expiryTimer);
  _expiryTimer = setInterval(() => {
    document.querySelectorAll('.myvid-expires').forEach(el => {
      el.textContent = _renderTimeLeft(parseInt(el.dataset.expires));
    });
  }, 1000);
}

function _registerHandlers() {
  on('myvid:notif:clear', () => {
    const cu = state.currentUser;
    if (!cu) return;
    const msgs = state.db.messages || {};
    Object.entries(msgs).forEach(([id, m]) => {
      if ((m.to === cu || m.recipient === cu) && !m.read) {
        writeDB(`messages/${id}/read`, true);
      }
    });
    toast(t('notifsCleared'), 'success');
    setTimeout(render, 300);
  });

  on('myvid:copy', async (el) => {
    const link = el.dataset.link;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast(t('mvCopied'), 'success', 1800);
    } catch {
      toast(link, 'info', 5000);
    }
  });

  on('myvid:delete', async (el) => {
    const vid = el.dataset.vidId;
    if (!vid) return;
    const ok = await confirm(t('mvDelTitle'), t('mvDelBody'));
    if (!ok) return;
    writeDB(`videos/${vid}`, null);
    // Keep postsTotal in sync so balance-gating and dashboard counts stay correct
    const cu = state.currentUser;
    if (cu) {
      const u = state.db.members?.[cu] || {};
      const current = u.postsTotal || 0;
      if (current > 0) writeDB(`members/${cu}/postsTotal`, current - 1);
    }
    toast(t('mvDeleted'), 'success');
    setTimeout(render, 300);
  });
}
