/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Feed / Home Screen  (Part C)
   ═══════════════════════════════════════════════════════ */

import { state }      from '../state.js';
import { t }          from '../i18n.js';
import { esc, avatarGradient, timeAgo, fbDec } from '../utils.js';
import { on }         from '../events.js';
import { startTimer } from '../components/timer.js';
import { goalPill, balanceMeter, circularTimer, startCircularTimer } from '../components/progress.js';
import { trustBadge } from '../features/trust.js';
import { emptyState } from '../components/empty-state.js';
import { isVerified, VERIFIED_BADGE } from '../features/verification.js';
import { isSupportLocked } from '../features/supportLock.js';
import { getNextFridayWIB } from '../utils.js';

const R1_NEED = 10;
const R2_NEED = 10;
const _r1Need = () => state.db.settings?.r1Need || R1_NEED;
const R1_MS   = 12 * 60 * 60 * 1000;
const BAL_CAP        = 40;
const SUPER_THRESH_H = 50;
const SUPER_MS_H     =  6 * 60 * 60 * 1000;

let _tab = 'feed'; // 'feed' | 'balance' | 'leaderboard'

export function setMode(m) {
  const MAP = { support:'feed', guthaben:'balance', leaderboard:'leaderboard', feed:'feed', balance:'balance' };
  _tab = MAP[m] || 'feed';
}

export function render() {
  const el = document.getElementById('screen-home');
  if (!el) return;

  const cu = state.currentUser;
  if (!cu || !state.db.members?.[cu]) return;

  const u     = state.db.members[cu];
  const stats = u.stats || {};
  const given = stats.given    || 0;
  const recv  = stats.received || 0;
  const bal   = Math.min(given - recv, BAL_CAP);
  const myKey = cu.toLowerCase();

  const openVideos = _openVideos(myKey);
  const todaySupports = _todaySupports(cu);

  el.innerHTML = `
    ${_poolStatusBar(openVideos.length, todaySupports, u)}
    <div class="weekly-reset-chip" id="home-weekly-chip">${_weeklyCountdownText()}</div>

    <div class="home-tabs" role="tablist">
      <button class="home-tab ${_tab==='feed'?'home-tab--active':''}"
        role="tab" data-action="home:tab" data-tab="feed">
        ${t('open') || 'Feed'}
        ${openVideos.length > 0 ? `<span class="home-tab__pip">${openVideos.length}</span>` : ''}
      </button>
      <button class="home-tab ${_tab==='balance'?'home-tab--active':''}"
        role="tab" data-action="home:tab" data-tab="balance">
        ${t('balance') || 'Guthaben'}
      </button>
      <button class="home-tab ${_tab==='leaderboard'?'home-tab--active':''}"
        role="tab" data-action="home:tab" data-tab="leaderboard">
        🏆 Top
      </button>
    </div>

    <div class="home-content" role="tabpanel">
      ${_tab === 'feed'        ? _renderFeedTab(openVideos, cu)         : ''}
      ${_tab === 'balance'     ? _renderBalanceTab(given, recv, bal, u) : ''}
      ${_tab === 'leaderboard' ? _renderLeaderboardTab(cu)              : ''}
    </div>
  `;

  _registerHandlers();
  _startWeeklyChipTimer();
  _startPulseTimer();

  if (_tab === 'balance' && u.lastPost) {
    const _isSuper = (stats.given || 0) >= SUPER_THRESH_H;
    const _cdMs    = _isSuper ? SUPER_MS_H : R1_MS;
    if ((Date.now() - u.lastPost) < _cdMs) startCircularTimer('home-ctimer');
  }
}

// ── Pool Status Bar ────────────────────────────────────────
function _poolStatusBar(openCount, todaySupports, u) {
  const streak   = _currentStreak(u);
  const health   = _poolHealth(openCount);
  const activity = openCount > 8 ? 'busy' : openCount > 2 ? 'active' : 'quiet';
  const actLabel = { busy: t('poolBusy'), active: t('poolActive'), quiet: t('poolQuiet') }[activity];

  return `
    <div class="pool-status-bar">
      <div class="pool-status-item">
        <div class="pool-status-item__val">${openCount}</div>
        <div class="pool-status-item__label">${t('statOpen')}</div>
      </div>
      <div class="pool-status-divider"></div>
      <div class="pool-status-item">
        <div class="pool-status-item__val">${todaySupports}</div>
        <div class="pool-status-item__label">${t('statToday')}</div>
      </div>
      <div class="pool-status-divider"></div>
      <div class="pool-status-item">
        <div class="pool-status-item__val pool-status-item__val--sm">${actLabel}</div>
        <div class="pool-status-item__label">${t('statPool')}</div>
      </div>
      <div class="pool-status-divider"></div>
      <div class="pool-status-item">
        <div class="pool-health-ring" title="Pool Health ${health.score}%">
          <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
            <circle cx="14" cy="14" r="11" fill="none" stroke="var(--bg-elevated)" stroke-width="3"/>
            <circle cx="14" cy="14" r="11" fill="none" stroke="${health.color}" stroke-width="3"
              stroke-linecap="round"
              stroke-dasharray="${(health.score / 100) * 69.1} 69.1"
              stroke-dashoffset="0"
              transform="rotate(-90 14 14)"/>
          </svg>
          <div class="pool-health-ring__val" style="color:${health.color}">${health.score}</div>
        </div>
        <div class="pool-status-item__label">${t('statHealth')}</div>
      </div>
      ${streak > 0 ? `
      <div class="pool-status-divider"></div>
      <div class="pool-status-item">
        <div class="pool-status-item__val pool-status-item__val--flame">🔥${streak}</div>
        <div class="pool-status-item__label">${t('statStreak')}</div>
      </div>` : ''}
    </div>
  `;
}

// ── Feed Tab ───────────────────────────────────────────────
function _renderFeedTab(videos, cu) {
  const locked = isSupportLocked(cu);
  if (!videos.length) {
    return emptyState('🎯', t('noOpen'), t('noOpenSub'),
      { action: 'post:open', actionLabel: `+ ${t('postBtn')}` })
      + _poolPulseSection();
  }
  return `<div class="feed-list">${videos.map(v => _videoCard(v, locked)).join('')}</div>`
    + _poolPulseSection();
}

function _videoCard(v, locked = false) {
  const r1    = (v.r1Supporters || []).length;
  const r1n   = v.r1Need || _r1Need();
  const owner = fbDec(v.ownerKey || v.owner || '?');
  const link  = v.link || v.url || '#';
  const round = v.round || 1;
  const r2    = (v.r2Supporters || []).length;
  const r2n   = R2_NEED;
  const activeR1Slots = r1n - r1;
  const activeR2Slots = r2n - r2;
  const slotsLeft = round >= 2 ? activeR2Slots : activeR1Slots;
  const urgent    = slotsLeft <= 3 && slotsLeft > 0;
  const boost     = slotsLeft === 1;
  const gradient  = avatarGradient(owner);
  const urlShort  = link.replace(/^https?:\/\/(www\.)?/, '').slice(0, 38);
  const isTikTok  = link.includes('tiktok.com');
  const sentiment = _sentimentBadge(v);
  const trust     = trustBadge(owner);
  const ownerUser = state.db.members?.[owner] || state.db.members?.[owner.toLowerCase()];
  const verBadge  = ownerUser && isVerified(ownerUser) ? VERIFIED_BADGE : '';

  const cardClass = [
    'feed-card',
    boost  ? 'feed-card--boost'  : '',
    urgent && !boost ? 'feed-card--urgent' : '',
  ].filter(Boolean).join(' ');

  const ctaDisabled = locked ? 'disabled aria-disabled="true"' : '';
  const ctaClass    = locked ? 'btn btn--ghost btn--full feed-card__cta feed-card__cta--locked'
                              : 'btn btn--primary btn--full feed-card__cta';

  return `
    <article class="${cardClass}" data-vid="${esc(v.id || link)}">
      ${boost ? `<div class="boost-banner">${t('boostBanner') || '⚡ Fast fertig — noch 1 Support!'}</div>` : ''}
      <div class="feed-card__head">
        <div class="feed-card__avatar" style="background:${gradient}" aria-hidden="true">
          ${owner.slice(0, 2).toUpperCase()}
        </div>
        <div class="feed-card__owner-info">
          <div class="feed-card__owner">${trust}${verBadge} @${esc(owner)}</div>
          ${v.postedAt ? `<div class="feed-card__time">${timeAgo(v.postedAt, state.lang)}</div>` : ''}
        </div>
        <div class="feed-card__head-right">
          ${sentiment}
          <span class="round-pill round-pill--r${round}">R${round}</span>
        </div>
      </div>

      <a class="feed-card__url" href="${esc(link)}" target="_blank" rel="noopener noreferrer" aria-label="Video öffnen">
        <span class="feed-card__url-icon">${isTikTok ? _ttIcon() : _linkIcon()}</span>
        <span class="feed-card__url-text">${esc(urlShort)}${urlShort.length >= 38 ? '…' : ''}</span>
        <span class="feed-card__url-arrow">↗</span>
      </a>

      <div class="feed-card__progress">
        <div class="feed-card__prog-header">
          <span class="feed-card__prog-label">
            ${urgent ? `<span style="color:var(--accent-danger)">${t('feedUrgent').replace('{n}', slotsLeft)}</span>` : 'Supports'}
          </span>
          ${goalPill(round >= 2 ? r2 : r1, round >= 2 ? r2n : r1n, 'Slots', { urgent })}
        </div>
      </div>

      ${locked ? `<div class="feed-lock-hint">${t('supportLocked') || '🔒 Erst Video posten, dann supporten'}</div>` : ''}

      <button class="${ctaClass}" ${ctaDisabled}
        data-action="${locked ? '' : 'support:open'}" data-vid="${esc(v.id || link)}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        ${locked ? (t('supportLockedBtn') || 'Support gesperrt') : t('supportBtn')}
      </button>
    </article>
  `;
}

// ── Pool-Puls ──────────────────────────────────────────────
let _pulseTimer = null;

function _poolPulseSection() {
  const today   = new Date().toISOString().slice(0, 10);
  const members = state.db.members || {};
  const videos  = state.db.videos  || {};

  const todayCount = Object.values(members).reduce((sum, m) => {
    const days = m.supportDays || m.activeDays || [];
    return sum + (days.includes(today) ? 1 : 0);
  }, 0);

  let topUser = null, topVal = 0;
  Object.entries(members).forEach(([k, m]) => {
    if ((m.weeklyGiven || 0) > topVal) { topVal = m.weeklyGiven; topUser = k; }
  });

  const newVid = Object.values(videos)
    .filter(v => v.postedAt && new Date(v.postedAt).toISOString().slice(0, 10) === today)
    .sort((a, b) => (b.postedAt || 0) - (a.postedAt || 0))[0];

  return `
    <div class="pool-pulse" id="pool-pulse">
      <div class="pool-pulse__title">⚡ ${t('poolPulse') || 'Pool-Puls'}</div>
      <div class="pool-pulse__stats">
        <div class="pool-pulse__stat">
          <div class="pool-pulse__stat-val">${todayCount}</div>
          <div class="pool-pulse__stat-label">${t('todaySupports') || 'Heute supportet'}</div>
        </div>
        ${(topUser || newVid) ? `<div class="pool-pulse__right">
          ${topUser ? `<div class="pool-pulse__stat">
            <div class="pool-pulse__stat-val pool-pulse__stat-val--name">@${esc(fbDec(topUser))}</div>
            <div class="pool-pulse__stat-label">${t('topToday') || 'Top heute'} · ${topVal}×</div>
          </div>` : ''}
          ${newVid ? `<div class="pool-pulse__stat">
            <div class="pool-pulse__stat-val pool-pulse__stat-val--name">@${esc(fbDec(newVid.ownerKey || newVid.owner || '?'))}</div>
            <div class="pool-pulse__stat-label">${t('newHighlight') || 'Neu im Pool'}</div>
          </div>` : ''}
        </div>` : ''}
      </div>
    </div>
  `;
}

function _startPulseTimer() {
  clearInterval(_pulseTimer);
  _pulseTimer = setInterval(() => {
    const el = document.getElementById('pool-pulse');
    if (!el) { clearInterval(_pulseTimer); return; }
    el.outerHTML = _poolPulseSection();
  }, 30000);
}

// ── Balance Tab ────────────────────────────────────────────
function _renderBalanceTab(given, recv, bal, u) {
  const isSuper    = given >= SUPER_THRESH_H;
  const cooldownMs = isSuper ? SUPER_MS_H : R1_MS;
  const cooldown   = u.lastPost && (Date.now() - u.lastPost) < cooldownMs;
  const balPct     = Math.max(0, Math.min(100, ((bal + BAL_CAP) / (BAL_CAP * 2)) * 100));
  const balClass   = bal > 0 ? 'positive' : bal < 0 ? 'negative' : 'neutral';

  return `
    <div class="balance-wrap">
      <div class="balance-card card--glass">
        <div class="balance-card__label">${t('balance') || 'Guthaben'}</div>
        ${balanceMeter(bal, BAL_CAP)}
      </div>

      <div class="balance-stats">
        <div class="balance-stat">
          <div class="balance-stat__num">${given}</div>
          <div class="balance-stat__label">${t('given') || 'Gegeben'}</div>
        </div>
        <div class="balance-stat-divider"></div>
        <div class="balance-stat">
          <div class="balance-stat__num">${recv}</div>
          <div class="balance-stat__label">${t('recv') || 'Erhalten'}</div>
        </div>
      </div>

      ${cooldown ? `
        <div class="balance-cooldown">
          <div class="balance-cooldown__label">${t('cooldownLabel')}</div>
          ${circularTimer(u.lastPost + cooldownMs - Date.now(), cooldownMs, { id: 'home-ctimer', size: 64, stroke: 5 })}
        </div>
      ` : `
        <button class="btn btn--primary btn--full" data-action="post:open" style="margin-top:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
          ${t('postBtn') || 'Video posten'}
        </button>
      `}
    </div>
  `;
}

// ── Leaderboard Tab ────────────────────────────────────────
function _renderLeaderboardTab(cu) {
  const members = Object.entries(state.db.members || {})
    .filter(([, m]) => (m.weeklyGiven || 0) > 0)
    .sort(([, a], [, b]) => (b.weeklyGiven || 0) - (a.weeklyGiven || 0))
    .slice(0, 10)
    .map(([key, m]) => ({ key, ...m }));

  if (!members.length) {
    return emptyState('🏆', t('lbNoData'), t('lbNoDataSub'));
  }

  const top3   = members.slice(0, 3);
  const rest   = members.slice(3);
  const medals = ['🥇', '🥈', '🥉'];
  const podiumH= ['72px', '56px', '44px'];

  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);

  return `
    <div class="lb-wrap">
      <div class="lb-header">
        <div class="lb-header__title">${t('lbTitle')}</div>
      </div>

      ${top3.length >= 2 ? `
      <div class="lb-podium">
        ${podiumOrder.map((m, i) => {
          const orig = top3.indexOf(m);
          const grad = avatarGradient(m.key);
          return `<div class="lb-podium__place lb-podium__place--${orig + 1}">
            <div class="lb-podium__avatar" style="background:${grad}">${(m.name || m.key || '?').slice(0,2).toUpperCase()}</div>
            <div class="lb-podium__medal">${medals[orig]}</div>
            <div class="lb-podium__name">${esc((m.name || m.key || '').split(' ')[0])}</div>
            <div class="lb-podium__score">${m.weeklyGiven || 0}</div>
            <div class="lb-podium__bar" style="height:${podiumH[orig]}"></div>
          </div>`;
        }).join('')}
      </div>` : ''}

      ${rest.length > 0 ? `
      <div class="lb-list">
        ${rest.map((m, i) => {
          const grad = avatarGradient(m.key);
          const isMe = m.key === cu;
          return `<div class="lb-row${isMe ? ' lb-row--me' : ''}">
            <div class="lb-row__rank">${i + 4}</div>
            <div class="lb-row__avatar" style="background:${grad}">${(m.name || m.key || '?').slice(0,2).toUpperCase()}</div>
            <div class="lb-row__name">${esc(m.name || m.key || '?')}${isMe ? ` <span class="lb-row__you">${t('lbYou')}</span>` : ''}</div>
            <div class="lb-row__score">${m.weeklyGiven || 0}</div>
          </div>`;
        }).join('')}
      </div>` : ''}
    </div>
  `;
}

// ── Helpers ────────────────────────────────────────────────
function _openVideos(myKey) {
  return Object.values(state.db.videos || {}).filter(v => {
    if (v.status === 'done' || v.status === 'expired') return false;
    if (v.status === 'scheduled' && (v.scheduledFor || 0) > Date.now()) return false;
    if ((v.ownerKey || v.owner || '').toLowerCase() === myKey) return false;
    const r1 = (v.r1Supporters || []).map(k => k.toLowerCase());
    const r2 = (v.r2Supporters || []).map(k => k.toLowerCase());
    if (r1.includes(myKey) || r2.includes(myKey)) return false;
    const rnd = v.round || 1;
    const r1n = v.r1Need || _r1Need();
    if (rnd === 1 && r1.length >= r1n) return false;
    if (rnd === 2 && r2.length >= R2_NEED) return false;
    return true;
  }).sort((a, b) => {
    const aLeft = (a.r1Need || _r1Need()) - (a.r1Supporters || []).length;
    const bLeft = (b.r1Need || _r1Need()) - (b.r1Supporters || []).length;
    return aLeft - bLeft;
  });
}

function _todaySupports(cu) {
  const today = new Date().toISOString().slice(0, 10);
  const todayKey = today.replace(/-/g, '_');
  const u = state.db.members?.[cu] || {};
  const direct = u.todayGiven?.[todayKey];
  if (direct !== undefined) return direct;
  const days = u.supportDays || u.activeDays || [];
  if (!days.includes(today)) return 0;
  const cutoff = Date.now() - 86400000;
  const myKey = cu.toLowerCase();
  const cnt = Object.values(state.db.videos || {}).filter(v => {
    if ((v.postedAt || 0) < cutoff) return false;
    const r = [...(v.r1Supporters || []), ...(v.r2Supporters || [])].map(k => k.toLowerCase());
    return r.includes(myKey);
  }).length;
  return Math.max(cnt, 1);
}

function _currentStreak(u) {
  const days = u.supportDays || u.activeDays || [];
  let streak = 0;
  const d = new Date();
  while (true) {
    const key = d.toISOString().slice(0, 10);
    if (!days.includes(key)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function _sentimentBadge(v) {
  const age = v.postedAt ? Date.now() - v.postedAt : Infinity;
  const r1  = (v.r1Supporters || []).length;
  const r1n = v.r1Need || _r1Need();
  const slots = r1n - r1;

  if (slots <= 2 && slots > 0) return `<span class="sf-badge sf-badge--urgent">${t('badgeFull')}</span>`;
  if (age < 2 * 60 * 60 * 1000) return `<span class="sf-badge sf-badge--new">${t('badgeNew')}</span>`;
  if (age > 20 * 60 * 60 * 1000) return `<span class="sf-badge sf-badge--old">${t('badgeOld')}</span>`;
  if (r1 >= r1n * 0.7) return `<span class="sf-badge sf-badge--hot">${t('badgeHot')}</span>`;
  return '';
}

function _poolHealth(openCount) {
  const members  = Object.keys(state.db.members || {}).length;
  const activity = Object.values(state.db.members || {}).filter(m => {
    const today = new Date().toISOString().slice(0, 10);
    return (m.supportDays || m.activeDays || []).includes(today);
  }).length;

  const actScore  = members > 0 ? Math.round((activity / members) * 50) : 0;
  const vidScore  = Math.round(Math.min(openCount, 10) / 10 * 50);
  const score     = Math.min(100, actScore + vidScore);
  const color     = score >= 60 ? '#10b981' : score >= 30 ? '#f59e0b' : '#ef4444';

  return { score, color };
}

function _linkIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
}

function _ttIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/></svg>`;
}

function _registerHandlers() {
  on('home:tab', (el) => {
    _tab = el.dataset.tab || 'feed';
    render();
  });
}

let _weeklyTimer = null;

function _weeklyCountdownText() {
  const diff  = getNextFridayWIB() - Date.now();
  const days  = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins  = Math.floor((diff % 3600000) / 60000);
  const rem   = t('remaining') || 'noch';
  const when  = t('weeklyResetWhen') || 'Fr 00:00 WIB';
  return `🔄 ${t('weeklyResetLabel') || 'Wochen-Reset'}: ${when} · ${rem} ${days}d ${hours}h ${mins}m`;
}

function _startWeeklyChipTimer() {
  clearInterval(_weeklyTimer);
  _weeklyTimer = setInterval(() => {
    const chip = document.getElementById('home-weekly-chip');
    if (!chip) { clearInterval(_weeklyTimer); return; }
    chip.textContent = _weeklyCountdownText();
  }, 60000);
}
