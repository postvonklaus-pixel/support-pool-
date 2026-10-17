/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Profile / Ich Screen  (Part E)
   ═══════════════════════════════════════════════════════ */

import { state }      from '../state.js';
import { t }          from '../i18n.js';
import { esc, avatarGradient, getNextFridayWIB } from '../utils.js';
import { on }         from '../events.js';
import { progressRing, streakFlames } from '../components/progress.js';
import { renderAchievements } from '../features/achievements.js';

function _ranks() {
  return [
    { min: 0,   max: 4,   label: t('rankLabel0'), icon: '🌱', color: '#94a3b8' },
    { min: 5,   max: 19,  label: t('rankLabel1'), icon: '⚡', color: '#22d3ee' },
    { min: 20,  max: 49,  label: t('rankLabel2'), icon: '🔥', color: '#7c3aed' },
    { min: 50,  max: 99,  label: t('rankLabel3'), icon: '🏆', color: '#f59e0b' },
    { min: 100, max: Infinity, label: t('rankLabel4'), icon: '👑', color: '#f43f5e' },
  ];
}

function rankFor(u, ranks) {
  const given = u.stats?.given || 0;
  return ranks.find(r => given >= r.min && given <= r.max) || ranks[0];
}

export function render() {
  const el = document.getElementById('screen-profile');
  if (!el) return;

  const cu = state.currentUser;
  if (!cu || !state.db.members?.[cu]) return;

  const u        = state.db.members[cu];
  const stats    = u.stats || {};
  const given    = stats.given    || 0;
  const received = stats.received || 0;
  const bal      = given - received;
  const ranks    = _ranks();
  const rank     = rankFor(u, ranks);
  const daysIn   = u.joined ? Math.max(0, Math.floor((Date.now() - u.joined) / 86400000)) : 0;
  const initial  = (cu || '?').slice(0, 2).toUpperCase();
  const gradient = avatarGradient(cu);
  const streak   = _currentStreak(u);
  const nextRank = ranks[ranks.indexOf(rank) + 1] || null;
  const toNext   = nextRank ? nextRank.min - given : 0;

  el.innerHTML = `
    <div class="profile-page">

      <!-- ── Hero ── -->
      <div class="profile-hero" style="--rank-color:${rank.color}">
        <div class="profile-hero__bg" aria-hidden="true"></div>
        <div class="profile-avatar-wrap" data-rank="${ranks.indexOf(rank)}">
          <div class="profile-rank-ring" aria-hidden="true"></div>
          <div class="profile-avatar" style="background:${gradient}">${initial}</div>
          <div class="profile-rank-badge" title="${rank.label}">${rank.icon}</div>
        </div>
        <div class="profile-name">${esc(u.name || cu)}</div>
        <div class="profile-handle">@${esc(cu)}</div>
        <div class="profile-rank-label" style="color:${rank.color}">${rank.icon} ${rank.label}</div>
        <div class="profile-weekly-chip" id="profile-weekly-chip">${_weeklyChipText()}</div>
      </div>

      <!-- ── Stats ── -->
      <div class="profile-stats-grid">
        <div class="profile-stat-card">
          ${progressRing(given, Math.max(given, nextRank?.min || given, 10), { label: t('pGiven'), size: 72, color: rank.color })}
        </div>
        <div class="profile-stat-card">
          ${progressRing(received, Math.max(received, given, 10), { label: t('pRecv'), size: 72, color: 'var(--accent-secondary, #7c3aed)' })}
        </div>
        <div class="profile-stat-card">
          <div class="profile-stat-card__val">${u.postsTotal || 0}</div>
          <div class="profile-stat-card__label">${t('pVids')}</div>
        </div>
        <div class="profile-stat-card">
          <div class="profile-stat-card__val">${daysIn}</div>
          <div class="profile-stat-card__label">${t('streakDays')}</div>
        </div>
      </div>

      <!-- ── Balance Band ── -->
      <div class="profile-section">
        <div class="profile-balance-row">
          <span class="profile-balance-row__label">${t('balance')}</span>
          <span class="profile-balance-row__val ${bal > 0 ? 'pos' : bal < 0 ? 'neg' : ''}">${bal > 0 ? '+' : ''}${bal}</span>
        </div>
      </div>

      <!-- ── Streak ── -->
      <div class="profile-section">
        <div class="profile-section__head">
          <span class="profile-section__title">${t('actStreak')}</span>
          ${streak > 0 ? `<span class="streak-badge">${t('streakDayBadge').replace('{n}', streak)}</span>` : ''}
        </div>
        ${streakFlames(u.supportDays || u.activeDays || [])}
      </div>

      <!-- ── Rang Fortschritt ── -->
      ${nextRank ? `
      <div class="profile-section">
        <div class="profile-section__head">
          <span class="profile-section__title">${t('rankProgress')}</span>
          <span class="profile-section__sub">${toNext} → ${nextRank.icon} ${nextRank.label}</span>
        </div>
        <div class="profile-rank-progress-row">
          ${progressRing(given - rank.min, nextRank.min - rank.min, {
            label: 'XP',
            size: 56,
            stroke: 5,
            color: nextRank.color,
          })}
          <div class="rank-progress-bar" style="flex:1">
            <div class="rank-progress-bar__fill" style="width:${Math.round(((given - rank.min) / (nextRank.min - rank.min)) * 100)}%"></div>
          </div>
          <div class="profile-rank-next">${nextRank.icon}</div>
        </div>
      </div>` : `
      <div class="profile-section">
        <div class="profile-section__head">
          <span class="profile-section__title">${t('rankEliteReached')}</span>
        </div>
      </div>`}

      <!-- ── Achievements ── -->
      <div class="profile-section">
        <div class="profile-section__head">
          <span class="profile-section__title">${t('achievTitle')}</span>
          <span class="profile-section__sub">${t('achievUnlocked').replace('{n}', (u.achievements || []).length)}</span>
        </div>
        ${renderAchievements(cu)}
      </div>

      <!-- ── Actions ── -->
      <div class="profile-section profile-actions">
        <button class="btn btn--gold btn--full" data-action="profile:check">
          ✨ ${t('profCheckBtn') || 'Profil-Check'}
        </button>
        <div class="profile-actions-row">
          <button class="btn btn--ghost btn--full" data-action="nav:goto" data-screen="settings" style="flex:1">
            ⚙️ ${t('settings') || 'Einstellungen'}
          </button>
          <button class="btn btn--danger" data-action="settings:logout" style="flex:1">
            ${t('logout') || 'Abmelden'}
          </button>
        </div>
      </div>

    </div>
  `;

  _registerHandlers();
  _startWeeklyChipTimer();
}

let _weeklyTimer = null;
function _startWeeklyChipTimer() {
  clearInterval(_weeklyTimer);
  _weeklyTimer = setInterval(() => {
    const chip = document.getElementById('profile-weekly-chip');
    if (!chip) { clearInterval(_weeklyTimer); return; }
    chip.textContent = _weeklyChipText();
  }, 60000);
}

function _currentStreak(u) {
  const days = u.supportDays || u.activeDays || [];
  let streak = 0;
  const d = new Date();
  while (days.includes(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function _registerHandlers() {
  // handlers delegated to events.js
}

function _weeklyChipText() {
  const diff  = getNextFridayWIB() - Date.now();
  const days  = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins  = Math.floor((diff % 3600000) / 60000);
  const rem   = t('remaining') || 'noch';
  const when  = t('weeklyResetWhen') || 'Fr 00:00 WIB';
  return `🔄 ${t('weeklyResetLabel') || 'Wochen-Reset'}: ${when} · ${rem} ${days}d ${hours}h ${mins}m`;
}
