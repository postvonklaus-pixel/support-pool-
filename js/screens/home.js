/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Feed / Home Screen  (Part C)
   ═══════════════════════════════════════════════════════ */

import { state }      from '../state.js';
import { t }          from '../i18n.js';
import { esc, avatarGradient, timeAgo } from '../utils.js';
import { on }         from '../events.js';
import { startTimer } from '../components/timer.js';

const R1_NEED = 10;
const R2_NEED = 10;
const R1_MS   = 24 * 60 * 60 * 1000;
const BAL_CAP = 20;

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

  if (_tab === 'balance' && u.lastPost && (Date.now() - u.lastPost) < R1_MS) {
    startTimer('post-cooldown', u.lastPost + R1_MS, {
      el: document.getElementById('home-countdown'),
    });
  }
}

// ── Pool Status Bar ────────────────────────────────────────
function _poolStatusBar(openCount, todaySupports, u) {
  const streak = _currentStreak(u);
  const activity = openCount > 8 ? 'busy' : openCount > 2 ? 'active' : 'quiet';
  const actLabel = { busy:'🔴 Überfüllt', active:'🟢 Aktiv', quiet:'🟡 Ruhig' }[activity];

  return `
    <div class="pool-status-bar">
      <div class="pool-status-item">
        <div class="pool-status-item__val">${openCount}</div>
        <div class="pool-status-item__label">offen</div>
      </div>
      <div class="pool-status-divider"></div>
      <div class="pool-status-item">
        <div class="pool-status-item__val">${todaySupports}</div>
        <div class="pool-status-item__label">heute</div>
      </div>
      <div class="pool-status-divider"></div>
      <div class="pool-status-item">
        <div class="pool-status-item__val pool-status-item__val--sm">${actLabel}</div>
        <div class="pool-status-item__label">Pool</div>
      </div>
      ${streak > 0 ? `
      <div class="pool-status-divider"></div>
      <div class="pool-status-item">
        <div class="pool-status-item__val pool-status-item__val--flame">🔥${streak}</div>
        <div class="pool-status-item__label">Streak</div>
      </div>` : ''}
    </div>
  `;
}

// ── Feed Tab ───────────────────────────────────────────────
function _renderFeedTab(videos, cu) {
  if (!videos.length) {
    return `<div class="empty-state" style="margin-top:48px">
      <div class="empty-state__icon">🎯</div>
      <div class="empty-state__title">${t('noOpen') || 'Alles supporten!'}</div>
      <div class="empty-state__sub">Gerade keine offenen Videos — schau später rein</div>
    </div>`;
  }
  return `<div class="feed-list">${videos.map(v => _videoCard(v)).join('')}</div>`;
}

function _videoCard(v) {
  const r1    = (v.r1Supporters || []).length;
  const r1n   = v.r1Need || R1_NEED;
  const pct   = Math.min(100, Math.round((r1 / r1n) * 100));
  const owner = v.ownerKey || v.owner || '?';
  const link  = v.link || v.url || '#';
  const round = v.round || 1;
  const slotsLeft = r1n - r1;
  const urgent    = slotsLeft <= 3 && slotsLeft > 0;
  const gradient  = avatarGradient(owner);
  const urlShort  = link.replace(/^https?:\/\/(www\.)?/, '').slice(0, 38);
  const isTikTok  = link.includes('tiktok.com');

  return `
    <article class="feed-card${urgent ? ' feed-card--urgent' : ''}" data-vid="${esc(v.id || link)}">
      <div class="feed-card__head">
        <div class="feed-card__avatar" style="background:${gradient}" aria-hidden="true">
          ${owner.slice(0, 2).toUpperCase()}
        </div>
        <div class="feed-card__owner-info">
          <div class="feed-card__owner">@${esc(owner)}</div>
          ${v.postedAt ? `<div class="feed-card__time">${timeAgo(v.postedAt, state.lang)}</div>` : ''}
        </div>
        <span class="round-pill round-pill--r${round}">R${round}</span>
      </div>

      <a class="feed-card__url" href="${esc(link)}" target="_blank" rel="noopener noreferrer" aria-label="Video öffnen">
        <span class="feed-card__url-icon">${isTikTok ? _ttIcon() : _linkIcon()}</span>
        <span class="feed-card__url-text">${esc(urlShort)}${urlShort.length >= 38 ? '…' : ''}</span>
        <span class="feed-card__url-arrow">↗</span>
      </a>

      <div class="feed-card__progress">
        <div class="feed-card__prog-header">
          <span class="feed-card__prog-label">
            ${urgent ? `<span style="color:var(--accent-danger)">⚡ Nur noch ${slotsLeft}!</span>` : `${r1} von ${r1n} Supports`}
          </span>
          <span class="feed-card__prog-pct">${pct}%</span>
        </div>
        <div class="feed-prog-bar">
          <div class="feed-prog-bar__fill${urgent ? ' feed-prog-bar__fill--urgent' : ''}" style="width:${pct}%"></div>
        </div>
      </div>

      <button class="btn btn--primary btn--full feed-card__cta"
        data-action="support:open" data-vid="${esc(v.id || link)}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        ${t('supportBtn') || 'Supporten'}
      </button>
    </article>
  `;
}

// ── Balance Tab ────────────────────────────────────────────
function _renderBalanceTab(given, recv, bal, u) {
  const cooldown  = u.lastPost && (Date.now() - u.lastPost) < R1_MS;
  const balPct    = Math.max(0, Math.min(100, ((bal + BAL_CAP) / (BAL_CAP * 2)) * 100));
  const balClass  = bal > 0 ? 'positive' : bal < 0 ? 'negative' : 'neutral';

  return `
    <div class="balance-wrap">
      <div class="balance-card card--glass">
        <div class="balance-card__label">${t('balance') || 'Guthaben'}</div>
        <div class="balance-card__val balance-card__val--${balClass}">${bal > 0 ? '+' : ''}${bal}</div>
        <div class="balance-meter">
          <div class="balance-meter__track">
            <div class="balance-meter__fill balance-meter__fill--${balClass}" style="width:${balPct}%"></div>
          </div>
          <div class="balance-meter__labels">
            <span>–${BAL_CAP}</span>
            <span>0</span>
            <span>+${BAL_CAP}</span>
          </div>
        </div>
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
          <div class="balance-cooldown__label">⏳ Nächstes Post möglich in</div>
          <div class="balance-cooldown__timer" id="home-countdown">--:--:--</div>
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
    return `<div class="empty-state" style="margin-top:48px">
      <div class="empty-state__icon">🏆</div>
      <div class="empty-state__title">Noch keine Daten</div>
      <div class="empty-state__sub">Werde der erste in dieser Woche!</div>
    </div>`;
  }

  const top3   = members.slice(0, 3);
  const rest   = members.slice(3);
  const medals = ['🥇', '🥈', '🥉'];
  const podiumH= ['72px', '56px', '44px'];

  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
  const podiumPos   = top3[1] ? [1, 0, 2] : [0, 1, 2];

  return `
    <div class="lb-wrap">
      <div class="lb-header">
        <div class="lb-header__title">Top-Supporter der Woche</div>
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
            <div class="lb-row__name">${esc(m.name || m.key || '?')}${isMe ? ' <span class="lb-row__you">Du</span>' : ''}</div>
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
    if ((v.ownerKey || v.owner || '').toLowerCase() === myKey) return false;
    const r1 = (v.r1Supporters || []).map(k => k.toLowerCase());
    const r2 = (v.r2Supporters || []).map(k => k.toLowerCase());
    if (r1.includes(myKey) || r2.includes(myKey)) return false;
    const rnd = v.round || 1;
    const r1n = v.r1Need || R1_NEED;
    if (rnd === 1 && r1.length >= r1n) return false;
    if (rnd === 2 && r2.length >= R2_NEED) return false;
    return true;
  }).sort((a, b) => {
    // Urgent (few slots) first
    const aLeft = (a.r1Need || R1_NEED) - (a.r1Supporters || []).length;
    const bLeft = (b.r1Need || R1_NEED) - (b.r1Supporters || []).length;
    return aLeft - bLeft;
  });
}

function _todaySupports(cu) {
  const today = new Date().toISOString().slice(0, 10);
  const u = state.db.members?.[cu] || {};
  return ((u.activeDays || []).includes(today) ? 1 : 0) +
    Object.values(state.db.videos || {})
      .filter(v => (v.r1Supporters || []).includes(cu) || (v.r2Supporters || []).includes(cu))
      .filter(v => {
        const ts = v.supportedAt?.[cu] || v.lastSupportTs || 0;
        return ts && new Date(ts).toISOString().slice(0, 10) === today;
      }).length;
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
