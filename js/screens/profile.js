/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Profile / Ich Screen  (Part E)
   ═══════════════════════════════════════════════════════ */

import { state }      from '../state.js';
import { t }          from '../i18n.js?v=20261128b';
import { esc, avatarGradient, getNextFridayWIB, todayWIB, fbDec } from '../utils.js';
import { on }         from '../events.js';
import { progressRing, streakFlames } from '../components/progress.js';
import { renderAchievements, ACHIEVEMENTS } from '../features/achievements.js';
import { isVerified, VERIFIED_BADGE } from '../features/verification.js';

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
  const _joinTs  = u.joinedAt || u.joined || 0;
  const daysIn   = _joinTs ? Math.max(0, Math.floor((Date.now() - _joinTs) / 86400000)) : 0;
  const initial  = (cu || '?').slice(0, 2).toUpperCase();
  const gradient = avatarGradient(cu);
  const streak   = _currentStreak(u);
  const nextRank = ranks[ranks.indexOf(rank) + 1] || null;
  const toNext   = nextRank ? nextRank.min - given : 0;

  // Weekly leaderboard position
  const _lbEntries = Object.entries(state.db.members || {})
    .filter(([, m]) => (m.weeklyGiven || 0) > 0 || (m.stats?.given || 0) > 0)
    .sort(([, a], [, b]) => {
      const w = (b.weeklyGiven || 0) - (a.weeklyGiven || 0);
      return w !== 0 ? w : (b.stats?.given || 0) - (a.stats?.given || 0);
    });
  const lbRank    = _lbEntries.findIndex(([k]) => k === cu) + 1;
  const lbTotal   = _lbEntries.length;
  // 5-row window centered on the current user (2 above, self, 2 below)
  const lbStart   = Math.max(0, Math.min(lbRank - 3, lbTotal - 5));
  const lbWindow  = _lbEntries.slice(lbStart, lbStart + 5);
  // Real video count as fallback (handles reset/new accounts where postsTotal = 0)
  const _realVids  = Object.values(state.db.videos || {}).filter(v =>
    (v.ownerKey || v.owner || '').toLowerCase() === cu.toLowerCase()
  ).length;
  const postsTotal = Math.max(u.postsTotal || 0, _realVids);

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
        <div class="profile-name">${esc(u.name || fbDec(cu))}${isVerified(u) ? '<span class="verified-badge verified-badge--lg" title="Verifiziert" aria-label="Verifiziert"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#3b82f6"/><polyline points="7 12 10.5 15.5 17 9" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' : ''}</div>
        <div class="profile-handle">@${esc(fbDec(cu))}</div>
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
          <div class="profile-stat-card__val">${postsTotal}</div>
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
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            ${streak > 0 ? `<span class="streak-badge">${t('streakDayBadge').replace('{n}', streak)}</span>` : ''}
            ${(u.streakRecord || 0) > 0 ? `<span class="streak-record-badge">${(t('streakRecord') || '🏅 Rekord: {n} Tage').replace('{n}', u.streakRecord)}</span>` : ''}
          </div>
        </div>
        ${streakFlames(u.supportDays || u.activeDays || [])}
      </div>

      <!-- ── Leaderboard Position ── -->
      ${lbRank > 0 ? `
      <div class="profile-section">
        <div class="profile-section__head">
          <span class="profile-section__title">🏆 ${t('lbTitle') || 'Top-Supporter der Woche'}</span>
          <span class="profile-section__sub">#${lbRank} / ${lbTotal}</span>
        </div>
        <div class="profile-lb-list">
          ${lbWindow.map(([key, m], i) => {
            const pos    = lbStart + i + 1;
            const isMe   = key === cu;
            const grad   = avatarGradient(key);
            const medals = { 1:'🥇', 2:'🥈', 3:'🥉' };
            const posLabel = medals[pos] || `#${pos}`;
            const mbr    = state.db.members?.[key];
            const vBadge = mbr && isVerified(mbr) ? VERIFIED_BADGE : '';
            return `<div class="profile-lb-row${isMe ? ' profile-lb-row--me' : ''}">
              <div class="profile-lb-row__pos">${posLabel}</div>
              <div class="profile-lb-row__avatar" style="background:${grad}">${(m.name || fbDec(key) || '?').slice(0,2).toUpperCase()}</div>
              <div class="profile-lb-row__name">${esc(m.name || fbDec(key) || key)}${vBadge}${isMe ? ` <span class="lb-row__you">${t('lbYou')}</span>` : ''}</div>
              <div class="profile-lb-row__score">${m.weeklyGiven || 0}<span class="lb-score__sep">/</span><span class="lb-score__total">${m.stats?.given || 0}</span></div>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}

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
          <span class="profile-section__sub">${t('achievUnlocked').replace('{n}', (u.achievements || []).length).replace('{total}', ACHIEVEMENTS.length)}</span>
        </div>
        ${renderAchievements(cu)}
      </div>

      <!-- ── Actions ── -->
      <div class="profile-section profile-actions">
        <button class="btn btn--gold btn--full" data-action="profile:check">
          ✨ ${t('profCheckBtn') || 'Profil-Check'}
        </button>
        ${u.role === 'team-admin' ? `
        <button class="btn btn--primary btn--full" data-action="profile:my-team">
          👥 ${t('profileMyTeam') || 'Mein Team'}
        </button>` : ''}
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
  let cur = new Date(Date.now() + 7 * 3600000); // WIB (UTC+7)
  while (days.includes(cur.toISOString().slice(0, 10))) {
    streak++;
    cur = new Date(+cur - 86400000);
  }
  return streak;
}

function _registerHandlers() {
  on('settings:logout', () => {
    if (window._nova?.logout) window._nova.logout();
    else import('../main.js').then(m => m.logout());
  });

  on('profile:my-team', () => {
    _openTeamAdminModal();
  });

  on('profile:team:pool-chat', () => {
    import('../components/modal.js').then(({ closeModal }) => closeModal('team-admin-modal'));
    import('../router.js').then(({ goScreen }) => goScreen('chat'));
  });

  on('profile:team:dm', (el) => {
    const partner = el.dataset.partner;
    if (!partner) return;
    import('../components/modal.js').then(({ closeModal }) => closeModal('team-admin-modal'));
    import('../router.js').then(({ goScreen }) => goScreen('chat')).then(() => {
      setTimeout(() => {
        const btn = document.createElement('button');
        btn.dataset.action = 'chat:dm:open';
        btn.dataset.partner = partner;
        btn.style.display = 'none';
        document.body.appendChild(btn);
        btn.click();
        btn.remove();
      }, 300);
    });
  });
}

function _openTeamAdminModal() {
  import('../components/modal.js').then(({ openModal }) => {
    const cu = state.currentUser;
    if (!cu) return;

    // Find my team
    const myGroup = Object.entries(state.db.groups || {}).find(([, g]) =>
      g.teamAdminKey === cu || (g.members || []).includes(cu)
    );
    if (!myGroup) {
      import('../components/toast.js').then(({ toast }) =>
        toast('Kein Team gefunden', 'warning')
      );
      return;
    }

    const [gid, g] = myGroup;
    const memberKeys = Array.isArray(g.members) ? g.members : Object.values(g.members || {});
    const members = memberKeys
      .map(k => ({ key: k, m: state.db.members?.[k] }))
      .filter(x => x.m);

    const activeMembers = members.filter(x => x.m.status === 'active' || !x.m.status);
    const openVids = Object.values(state.db.videos || {}).filter(v =>
      v.status === 'open' && memberKeys.includes(v.ownerKey || v.owner)
    ).length;
    const teamBalance = members.reduce((s, { m }) =>
      s + ((m.stats?.given || 0) - (m.stats?.received || 0)), 0
    );

    import('../utils.js').then(({ esc, avatarGradient, fbDec }) => {
      openModal({
        id: 'team-admin-modal',
        title: `${esc(g.name)} · ${t('teamAdminModalTitle') || 'Admin-Ansicht'}`,
        body: `
          <div style="display:flex;gap:12px;margin-bottom:16px">
            <div class="profile-stat-card" style="flex:1;text-align:center;padding:10px 6px">
              <div style="font-size:22px;font-weight:700;color:var(--accent)">${activeMembers.length}</div>
              <div style="font-size:11px;color:var(--fg-3)">Mitglieder</div>
            </div>
            <div class="profile-stat-card" style="flex:1;text-align:center;padding:10px 6px">
              <div style="font-size:22px;font-weight:700;color:var(--accent)">${openVids}</div>
              <div style="font-size:11px;color:var(--fg-3)">Offene Videos</div>
            </div>
            <div class="profile-stat-card" style="flex:1;text-align:center;padding:10px 6px">
              <div style="font-size:22px;font-weight:700;color:${teamBalance>=0?'#22c55e':'#ef4444'}">${teamBalance>=0?'+':''}${teamBalance}</div>
              <div style="font-size:11px;color:var(--fg-3)">Team-Balance</div>
            </div>
          </div>
          <div style="font-size:13px;font-weight:600;color:var(--fg-2);margin-bottom:8px">Mitglieder</div>
          <div style="max-height:240px;overflow-y:auto;display:flex;flex-direction:column;gap:6px">
            ${members.map(({ key, m }) => {
              const grad = avatarGradient(key);
              const name = esc(m.name || fbDec(key));
              const bal  = (m.stats?.given || 0) - (m.stats?.received || 0);
              const balCls = bal > 0 ? '#22c55e' : bal < 0 ? '#ef4444' : 'var(--fg-3)';
              return `<div style="display:flex;align-items:center;gap:10px;padding:6px 2px">
                <div style="width:32px;height:32px;border-radius:50%;background:${grad};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0">${key.slice(0,2).toUpperCase()}</div>
                <div style="flex:1;min-width:0">
                  <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</div>
                  <div style="font-size:11px;color:var(--fg-3)">G:${m.stats?.given||0} · R:${m.stats?.received||0}</div>
                </div>
                <span style="font-size:12px;font-weight:600;color:${balCls};flex-shrink:0">${bal>0?'+':''}${bal}</span>
                <button class="btn btn--ghost btn--icon btn--sm" data-action="profile:team:dm" data-partner="${esc(key)}" title="DM senden">💬</button>
              </div>`;
            }).join('')}
          </div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn--primary btn--full" data-action="profile:team:pool-chat">
              💬 Pool-Chat öffnen
            </button>
            <button class="btn btn--ghost" data-action="modal:close" data-modal="team-admin-modal">
              Schließen
            </button>
          </div>`,
        actions: []
      });
    });
  });
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
