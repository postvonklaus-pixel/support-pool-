/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — My Videos Screen
   ═══════════════════════════════════════════════════════ */

import { state }    from '../state.js';
import { t }        from '../i18n.js';
import { esc }      from '../utils.js';
import { on }       from '../events.js';
import { writeDB }  from '../firebase.js';
import { toast }    from '../components/toast.js';
import { confirm }  from '../components/modal.js';

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

  el.innerHTML = `
    <div class="page-header">
      <div class="page-header__title">${t('myVidsTile') || '🎞️ Meine Videos'}</div>
    </div>
    <div class="myvids-scroll">
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
        <button class="btn btn--primary btn--sm" data-action="post:open">
          + ${t('postBtn') || 'Video posten'}
        </button>
      </div>
      ${!myVids.length ? `
        <div class="empty-state">
          <div class="empty-state__icon">🎬</div>
          <div class="empty-state__title">${t('noMy')}</div>
          <div class="empty-state__sub">${t('mvFirstSub')}</div>
          <button class="btn btn--primary" data-action="post:open" style="margin-top:16px">
            ${t('postBtn') || 'Video posten'}
          </button>
        </div>
      ` : myVids.map(v => _vidCard(v)).join('')}
    </div>
  `;

  _registerHandlers();
}

function _vidCard(v) {
  const r1   = (v.r1Supporters || []).length;
  const r2   = (v.r2Supporters || []).length;
  const r1n  = v.r1Need || R1_NEED;
  const pct1 = Math.min(100, Math.round((r1 / r1n) * 100));
  const pct2 = Math.min(100, Math.round((r2 / R2_NEED) * 100));
  const isDone = v.status === 'done';
  const link = v.link || v.url || '#';

  return `<div class="card card--glass myvid-card" data-vid-id="${esc(v.id || '')}">
    <div class="myvid-card__header">
      <a href="${esc(link)}" target="_blank" rel="noopener" class="myvid-card__link">
        🔗 ${esc(link.replace(/^https?:\/\/(www\.)?/, '').slice(0,40))}
      </a>
      <span class="badge ${isDone ? 'badge--success' : 'badge--primary'}">
        ${isDone ? t('mvDone') : `R${v.round || 1}`}
      </span>
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

function _registerHandlers() {
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
