/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — My Videos Screen
   ═══════════════════════════════════════════════════════ */

import { state }    from '../state.js';
import { t }        from '../i18n.js';
import { esc, timeAgo, getNextFridayWIB } from '../utils.js';
import { renderNotification } from '../features/notifications.js';
import { on }       from '../events.js';
import { writeDB }  from '../firebase.js';
import { toast }    from '../components/toast.js';
import { confirm }  from '../components/modal.js';
import { progressRing } from '../components/progress.js';
import { goScreen } from '../router.js';

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
  const unread = notifs.filter(n => !n.read && !n.skipUnread).length;

  el.innerHTML = header + `
    <div class="myvids-scroll">
      ${_renderExpireBanner(cu, myVids)}
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
  // Countdown updates handled by global startCountdownTicker() in main.js
}

// ── Ticket 6: 24h Expire Warning Banner ───────────────────
function _renderExpireBanner(cu, myVids) {
  const myKey  = cu.toLowerCase();
  const u      = state.db.members?.[cu] || state.db.members?.[myKey] || {};
  const weeklyGiven = u.weeklyGiven || 0;
  const bal    = (u.stats?.given || 0) - (u.stats?.received || 0);
  const safe   = weeklyGiven >= 3 || bal >= 0;

  // Find warned video and clear flag from RTDB if obligation is met
  const warnedEntry = Object.entries(state.db.videos || {}).find(([, v]) =>
    v.warned24h &&
    v.status !== 'done' && v.status !== 'expired' && v.status !== 'scheduled' &&
    (v.ownerKey || v.owner || '').toLowerCase() === myKey
  );
  if (!warnedEntry) return '';

  if (safe) {
    writeDB(`videos/${warnedEntry[0]}/warned24h`, null);
    return '';
  }

  const warned = warnedEntry[1];

  const now       = Date.now();
  const posted    = warned.postedAt || 0;
  const expiresAt = warned.expiresAt || Math.max(getNextFridayWIB(), posted + 86400000);
  const timeLeft  = Math.max(0, expiresAt - now);
  const hLeft     = Math.max(1, Math.ceil(timeLeft / 3600000));
  const bannerTxt = (t('notifExpireWarn24h') || '⚠️ Dein Video wird in {h}h entfernt. Supporte 3 Videos, um es zu halten.')
    .replace('{h}', hLeft);

  return `
    <div class="expire-warn-banner">
      <div class="expire-warn-banner__text">${esc(bannerTxt)}</div>
      <button class="btn btn--warning btn--sm expire-warn-banner__btn" data-action="myvid:expirewarn:cta">
        ${t('expireWarnCta') || 'Jetzt 3 Videos supporten →'}
      </button>
    </div>`;
}

// ── Status-Card (B2.3) ─────────────────────────────────────
function _renderStatusCard(vids) {
  const active = vids.find(v => v.status !== 'done' && v.status !== 'expired' && v.status !== 'scheduled');
  if (!active) return '';
  const round = active.round || 1;
  const r1    = (active.r1Supporters || []).length;
  const r1n   = active.r1Need || R1_NEED;
  const r2    = (active.r2Supporters || []).length;
  const cur   = round >= 2 ? r2  : r1;
  const max   = round >= 2 ? R2_NEED : r1n;
  const pct   = Math.min(100, Math.round((cur / max) * 100));
  const link  = active.link || active.url || '#';

  return `
    <div class="myvid-status-card card--glass">
      <div class="myvid-status-card__ring">
        ${progressRing(cur, max, { label: `${pct}%`, size: 80, stroke: 7, color: 'var(--accent-primary)' })}
      </div>
      <div class="myvid-status-card__body">
        <div class="myvid-status-card__title">🎬 ${t('activeVid')} · R${round}</div>
        <div class="myvid-status-card__link">${esc(link.replace(/^https?:\/\/(www\.)?/,'').slice(0,36))}</div>
        <div class="myvid-status-card__prog">${cur} ${t('notifFrom')} ${max} ${t('statusCardSup')}</div>
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

// ── Ticket 8: Back-Support Candidates ─────────────────────
// Returns Map<fromKeyLower, { vidId, name }> for supporters who have
// an open video the current user hasn't supported yet.
function _getBackSupportCandidates(cu) {
  const cuLow  = cu.toLowerCase();
  const msgs   = state.db.messages || {};
  const videos = state.db.videos   || {};
  const fromKeys = new Set();
  Object.values(msgs).forEach(m => {
    if ((m.to === cu || m.recipient === cu) &&
        m.type === 'notif' && m.subtype === 'support' && m.from) {
      fromKeys.add(m.from);
    }
  });
  const candidates = new Map();
  fromKeys.forEach(fromKey => {
    if (fromKey.toLowerCase() === cuLow) return;
    const vid = Object.values(videos).find(v => {
      if (v.status === 'done' || v.status === 'expired' || v.status === 'scheduled') return false;
      if ((v.ownerKey || v.owner || '').toLowerCase() !== fromKey.toLowerCase()) return false;
      const r1 = (v.r1Supporters || []).map(k => k.toLowerCase());
      const r2 = (v.r2Supporters || []).map(k => k.toLowerCase());
      return !r1.includes(cuLow) && !r2.includes(cuLow);
    });
    if (vid) {
      const name = state.db.members?.[fromKey]?.name || fromKey;
      candidates.set(fromKey.toLowerCase(), { vidId: vid.id, name });
    }
  });
  return candidates;
}

// ── Ticket 8: update #nav-meine-pip ───────────────────────
export function updateMeinePip(cu) {
  const pipEl = document.getElementById('nav-meine-pip');
  if (!pipEl) return;
  if (!cu || !state.db) { pipEl.classList.add('hidden'); return; }
  const n = _getBackSupportCandidates(cu).size;
  if (n > 0) {
    pipEl.textContent = n;
    pipEl.classList.remove('hidden');
  } else {
    pipEl.textContent = '';
    pipEl.classList.add('hidden');
  }
}

function _renderNotifSection(notifs, cu) {
  const unread     = notifs.filter(n => !n.read && !n.skipUnread).length;
  const candidates = _getBackSupportCandidates(cu);
  const backCount  = candidates.size;
  const userLang   = state.db.members?.[cu]?.lang || state.lang;
  return `
    <div class="myvid-notif-section">
      <div class="myvid-notif-section__head">
        <span class="myvid-notif-section__title">
          🔔 ${t('notifs')}${unread > 0 ? ` <span class="notif-pip">${unread}</span>` : ''}${backCount > 0 ? ` <span class="notif-pip notif-pip--back">${backCount} ↩</span>` : ''}
        </span>
        <button class="btn btn--ghost btn--sm" data-action="myvid:notif:clear">${t('notifsDelAll')}</button>
      </div>
      ${notifs.map(n => {
        const fromLow  = (n.from || '').toLowerCase();
        const backCand = n.subtype === 'support' && fromLow && candidates.has(fromLow)
          ? candidates.get(fromLow) : null;
        return `
        <div class="myvid-notif-item${n.read ? '' : (!n.skipUnread ? ' myvid-notif-item--unread' : '')}" data-notif-id="${esc(n._id)}">
          <div class="myvid-notif-item__icon">${n.icon || '🔔'}</div>
          <div class="myvid-notif-item__body">
            <div class="myvid-notif-item__text">${esc(renderNotification(n, userLang))}</div>
            ${n.subtype === 'expireWarn24h' ? `
            <button class="btn btn--warning btn--sm myvid-notif-cta" data-action="myvid:expirewarn:cta" style="margin-top:6px">
              ${t('expireWarnCta') || 'Jetzt 3 Videos supporten →'}
            </button>` : ''}
            ${backCand ? `
            <button class="btn btn--primary btn--sm myvid-notif-cta" data-action="myvid:backsupport" data-vid="${esc(backCand.vidId)}" style="margin-top:6px">
              ${t('backSupportBtn') || 'Support zurück →'}
            </button>` : ''}
            <div class="myvid-notif-item__meta">${n.ts ? timeAgo(n.ts) : ''}</div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

const _LOCALE_MAP = { de:'de-DE', en:'en-GB', id:'id-ID', it:'it-IT', es:'es-ES', tr:'tr-TR', ar:'ar-SA', zh:'zh-CN', ja:'ja-JP', pl:'pl-PL' };
function _fmtDate(ts) {
  if (!ts) return '';
  const locale = _LOCALE_MAP[state.lang] || 'de-DE';
  return new Date(ts).toLocaleString(locale, { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
}

function _vidCard(v) {
  const r1   = (v.r1Supporters || []).length;
  const r2   = (v.r2Supporters || []).length;
  const r1n  = v.r1Need || R1_NEED;
  const pct1 = Math.min(100, Math.round((r1 / r1n) * 100));
  const pct2 = Math.min(100, Math.round((r2 / R2_NEED) * 100));
  const isDone      = v.status === 'done';
  const isScheduled = v.status === 'scheduled' && (v.scheduledFor || 0) > Date.now();
  const round       = v.round || 1;
  const link        = v.link || v.url || '#';
  const schedLabel  = isScheduled
    ? new Date(v.scheduledFor).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
    : null;

  const postedTs  = v.postedAt || v.ts || 0;
  const expiresTs = round >= 2 ? (v.expiresR2 || v.expiresR1 || 0) : (v.expiresR1 || 0);
  const doneTs    = v.doneAt || 0;

  // Build timeline strip
  const timelineRows = [];

  if (postedTs) {
    timelineRows.push(`
      <div class="vt-row">
        <span class="vt-label">📅 ${t('vtPosted') || 'Gepostet'}:</span>
        <span class="vt-value">${_fmtDate(postedTs)}</span>
      </div>`);
  }

  if (isDone) {
    timelineRows.push(`
      <div class="vt-row">
        <span class="vt-label">✅ ${t('vtDone') || 'Fertig'}:</span>
        <span class="vt-value">${doneTs ? _fmtDate(doneTs) : t('vtExpired') || 'Abgelaufen'}</span>
      </div>`);
  } else if (expiresTs) {
    const isExpired = expiresTs <= Date.now();
    const countdownText = isExpired
      ? `(${t('vtExpired') || 'abgelaufen'})`
      : `(${t('vtIn') || 'in'} ${_renderTimeLeft(expiresTs)})`;
    timelineRows.push(`
      <div class="vt-row vt-active">
        <span class="vt-label">⏰ ${t('vtExpires') || 'Läuft ab'}:</span>
        <span class="vt-value">${_fmtDate(expiresTs)}</span>
        <span class="vt-countdown" data-expires="${expiresTs}">${countdownText}</span>
      </div>`);
  }

  return `<div class="card card--glass myvid-card" data-vid-id="${esc(v.id || '')}">
    <div class="myvid-card__header">
      <a href="${esc(link)}" target="_blank" rel="noopener" class="myvid-card__link">
        🔗 ${esc(link.replace(/^https?:\/\/(www\.)?/, '').slice(0,40))}
      </a>
      <span class="badge ${isDone ? 'badge--success' : isScheduled ? 'badge--warning' : 'badge--primary'}">
        ${isDone ? t('mvDone') : isScheduled ? `⏰ ${schedLabel}` : `R${round}`}
      </span>
    </div>
    <div class="myvid-card__progress">
      <div class="myvid-card__prog-label">R1 <span>${r1}/${r1n}</span></div>
      <div class="progress-bar"><div class="progress-bar__fill" style="width:${pct1}%"></div></div>
    </div>
    ${round >= 2 ? `
    <div class="myvid-card__progress">
      <div class="myvid-card__prog-label">R2 <span>${r2}/${R2_NEED}</span></div>
      <div class="progress-bar"><div class="progress-bar__fill" style="width:${pct2}%"></div></div>
    </div>` : ''}
    ${timelineRows.length ? `<div class="video-timeline">${timelineRows.join('')}</div>` : ''}
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
  if (!diff) return t('vtExpired') || 'Abgelaufen';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h}h ${m}m ${s}s`;
}

function _registerHandlers() {
  on('myvid:notif:clear', () => {
    const cu = state.currentUser;
    if (!cu) return;
    const msgs = state.db.messages || {};
    Object.entries(msgs).forEach(([id, m]) => {
      if ((m.to === cu || m.recipient === cu) && m.type === 'notif') {
        writeDB(`messages/${id}`, null);
      }
    });
    toast(t('notifsCleared'), 'success');
    setTimeout(render, 300);
  });

  // Ticket 6: CTA → Home Feed mit vorausgewählten 3 Videos
  on('myvid:expirewarn:cta', () => {
    const cu = state.currentUser;
    if (!cu) return;
    const myKey = cu.toLowerCase();
    const R1_N  = 10;

    const candidates = Object.values(state.db.videos || {})
      .filter(v => {
        if (v.status === 'done' || v.status === 'expired' || v.status === 'scheduled') return false;
        if ((v.ownerKey || v.owner || '').toLowerCase() === myKey) return false;
        const round = v.round || 1;
        const r1    = (v.r1Supporters || []).length;
        const r1n   = v.r1Need || R1_N;
        if (round === 1 && r1 >= r1n) return false;
        return true;
      })
      .sort((a, b) => (b.postedAt || 0) - (a.postedAt || 0))
      .slice(0, 3);

    state.ui._expireWarnVideos = candidates.map(v => v.id);
    state.ui._pendingHomeTab   = 'feed';
    goScreen('home');
  });

  // Ticket 8: Back-Support CTA → Home Feed mit dem Video des Supporters oben
  on('myvid:backsupport', (el) => {
    const vidId = el.dataset.vid;
    if (!vidId) return;
    state.ui._expireWarnVideos = [vidId];
    state.ui._pendingHomeTab   = 'feed';
    goScreen('home');
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
