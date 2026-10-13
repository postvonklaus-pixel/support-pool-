/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Home / Support Videos Screen
   ═══════════════════════════════════════════════════════ */

import { state }      from '../state.js';
import { t }          from '../i18n.js';
import { esc }        from '../utils.js';
import { on }         from '../events.js';
import { startTimer } from '../components/timer.js';

const R1_NEED = 10;
const R2_NEED = 10;
const R1_MS   = 24 * 60 * 60 * 1000;  // 24h cooldown
const BAL_CAP = 20;

let _mode = 'support'; // 'support' | 'guthaben' | 'leaderboard'

export function setMode(m) { _mode = m; }

export function render() {
  const el = document.getElementById('screen-home');
  if (!el) return;

  const cu = state.currentUser;
  if (!cu || !state.db.members?.[cu]) return;

  const u      = state.db.members[cu];
  const stats  = u.stats || {};
  const given  = stats.given    || 0;
  const recv   = stats.received || 0;
  const bal    = Math.min(given - recv, BAL_CAP);
  const myKey  = cu.toLowerCase();

  el.innerHTML = `
    <div class="page-header">
      <div class="page-header__title">${t('navHome')}</div>
    </div>

    <!-- Mode tabs -->
    <div class="home-tabs">
      <button class="home-tab ${_mode==='support'?'home-tab--active':''}" data-action="home:tab" data-tab="support">
        ${t('open') || 'Offene Videos'}
      </button>
      <button class="home-tab ${_mode==='guthaben'?'home-tab--active':''}" data-action="home:tab" data-tab="guthaben">
        ${t('balance') || 'Guthaben'}
      </button>
      <button class="home-tab ${_mode==='leaderboard'?'home-tab--active':''}" data-action="home:tab" data-tab="leaderboard">
        🏆 Top
      </button>
    </div>

    <!-- Tab content -->
    <div class="home-content">
      ${_mode === 'support'   ? _renderSupportTab(cu, myKey)        : ''}
      ${_mode === 'guthaben'  ? _renderGuthabenTab(given, recv, bal, u) : ''}
      ${_mode === 'leaderboard' ? _renderLeaderboardTab()            : ''}
    </div>
  `;

  _registerHandlers();

  // Start countdown if active
  if (_mode === 'guthaben' && u.lastPost && (Date.now() - u.lastPost) < R1_MS) {
    startTimer('post-cooldown', u.lastPost + R1_MS, {
      el: document.getElementById('home-countdown'),
    });
  }
}

// ── Support tab ───────────────────────────────────────────
function _renderSupportTab(cu, myKey) {
  const videos = Object.values(state.db.videos || {}).filter(v => {
    if (v.status === 'done' || v.status === 'expired') return false;
    if ((v.ownerKey || v.owner || '').toLowerCase() === myKey) return false;
    const r1 = (v.r1Supporters || []).map(k => k.toLowerCase());
    const r2 = (v.r2Supporters || []).map(k => k.toLowerCase());
    if (r1.includes(myKey) || r2.includes(myKey)) return false;
    const rnd = v.round || 1;
    if (rnd === 1 && r1.length >= (v.r1Need || R1_NEED)) return false;
    if (rnd === 2 && r2.length >= R2_NEED) return false;
    return true;
  });

  if (!videos.length) {
    return `<div class="empty-state" style="margin-top:48px">
      <div class="empty-state__icon">🎯</div>
      <div class="empty-state__title">${t('noOpen') || 'Keine Videos zum Supporten'}</div>
      <div class="empty-state__sub">Schau später nochmal rein</div>
    </div>`;
  }

  return `<div class="video-list">${videos.map(v => _videoCard(v)).join('')}</div>`;
}

function _videoCard(v) {
  const r1   = (v.r1Supporters || []).length;
  const r1n  = v.r1Need || R1_NEED;
  const pct  = Math.min(100, Math.round((r1 / r1n) * 100));
  const owner= v.ownerKey || v.owner || '?';
  const link = v.link || v.url || '#';

  return `<div class="video-card card card--glass card--interactive">
    <div class="video-card__meta">
      <div class="avatar avatar--xs">${owner.slice(0,2).toUpperCase()}</div>
      <span class="video-card__owner">@${esc(owner)}</span>
      <span class="video-card__round badge badge--primary">R${v.round || 1}</span>
    </div>
    <a class="video-card__link" href="${esc(link)}" target="_blank" rel="noopener">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
      ${esc(link.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40))}
    </a>
    <div class="video-card__progress">
      <div class="progress-bar"><div class="progress-bar__fill" style="width:${pct}%"></div></div>
      <span class="video-card__pct">${r1}/${r1n}</span>
    </div>
    <button class="btn btn--primary btn--full btn--sm" data-action="support:open" data-vid="${esc(v.id || v.link || '')}">
      💬 Supporten
    </button>
  </div>`;
}

// ── Guthaben tab ──────────────────────────────────────────
function _renderGuthabenTab(given, recv, bal, u) {
  const balColor = bal >= 0 ? 'var(--success)' : 'var(--danger)';
  const cooldown = u.lastPost && (Date.now() - u.lastPost) < R1_MS;

  return `
    <div class="guthaben-wrap">
      <div class="guthaben-balance" style="color:${balColor}">${bal}</div>
      <div class="guthaben-label">${t('balance') || 'Guthaben'}</div>
      <div class="guthaben-stats">
        <div class="guthaben-stat">
          <div class="guthaben-stat__num">${given}</div>
          <div class="guthaben-stat__label">${t('given') || 'Gegeben'}</div>
        </div>
        <div class="guthaben-stat">
          <div class="guthaben-stat__num">${recv}</div>
          <div class="guthaben-stat__label">${t('recv') || 'Erhalten'}</div>
        </div>
      </div>
      ${cooldown ? `
        <div class="guthaben-cooldown">
          ⏳ <span id="home-countdown">--:--:--</span>
        </div>
      ` : `
        <button class="btn btn--primary btn--full" data-action="post:open" style="margin-top:24px">
          🎬 ${t('postBtn') || 'Video posten'}
        </button>
      `}
    </div>`;
}

// ── Leaderboard tab ───────────────────────────────────────
function _renderLeaderboardTab() {
  const members = Object.values(state.db.members || {})
    .filter(m => m.weeklyGiven > 0)
    .sort((a, b) => (b.weeklyGiven || 0) - (a.weeklyGiven || 0))
    .slice(0, 10);

  if (!members.length) {
    return `<div class="empty-state" style="margin-top:48px">
      <div class="empty-state__icon">🏆</div>
      <div class="empty-state__sub">${t('lbTitle') || 'Noch keine Daten'}</div>
    </div>`;
  }

  const medals = ['🥇','🥈','🥉'];

  return `<div class="lb-list">
    <div class="section-title">${t('lbTitle') || 'Top-Supporter der Woche'}</div>
    ${members.map((m, i) => `
      <div class="list-item">
        <div class="list-item__rank">${medals[i] || (i + 1)}</div>
        <div class="list-item__body">
          <div class="list-item__title">${esc(m.name || '?')}</div>
        </div>
        <div class="list-item__aside">
          <span class="badge badge--primary">${m.weeklyGiven || 0}</span>
        </div>
      </div>
    `).join('')}
  </div>`;
}

function _registerHandlers() {
  on('home:tab', (el) => {
    _mode = el.dataset.tab || 'support';
    render();
  });
}
