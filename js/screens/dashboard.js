/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Dashboard Screen (Bento redesign)
   ═══════════════════════════════════════════════════════ */

import { state }       from '../state.js';
import { t }           from '../i18n.js';
import { goScreen }    from '../router.js';
import { on }          from '../events.js';

const R1_NEED = 10;
const R2_NEED = 10;

// ── Lucide-style SVG icons ────────────────────────────────
const IC = {
  videos:   `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>`,
  post:     `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
  balance:  `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  profile:  `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  myvideos: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>`,
  caption:  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`,
  settings: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  admin:    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  weekly:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
};

export function render() {
  const el = document.getElementById('screen-dashboard');
  if (!el) return;

  const cu = state.currentUser;
  if (!cu || !state.db.members?.[cu]) return;

  const u        = state.db.members[cu];
  const stats    = u.stats || {};
  const given    = stats.given    || 0;
  const received = stats.received || 0;
  const balance  = Math.min(given - received, 20);
  const myKey    = cu.toLowerCase();
  const isAdmin  = u.role === 'admin';
  const weeklyGiven = u.weeklyGiven || 0;

  const openCnt = Object.values(state.db.videos || {}).filter(v => {
    if (v.status === 'done' || v.status === 'expired') return false;
    if ((v.ownerKey || v.owner || '').toLowerCase() === myKey) return false;
    const r1 = (v.r1Supporters || []).map(k => k.toLowerCase());
    const r2 = (v.r2Supporters || []).map(k => k.toLowerCase());
    if (r1.includes(myKey) || r2.includes(myKey)) return false;
    const rnd = v.round || 1;
    if (rnd === 1 && r1.length >= (v.r1Need || R1_NEED)) return false;
    if (rnd === 2 && r2.length >= R2_NEED) return false;
    return true;
  }).length;

  const unreadNotifs = Object.values(state.db.messages || {}).filter(m =>
    m.to === cu && (m.type === 'notif' || m.type === 'dm' || m.reply) && !m.read
  ).length;

  const balColor = balance >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)';
  const myVids   = Object.values(state.db.videos || {}).filter(v =>
    (v.ownerKey || v.owner || '').toLowerCase() === myKey
  ).length;

  el.innerHTML = `
    <div class="page-header">
      <div class="page-header__title">Dashboard</div>
    </div>
    <div class="dash-scroll">

      <!-- Row 1: Offene Videos + Video posten (LARGE) -->
      <div class="dash-row">

        <div class="dash-tile dash-tile--support ${openCnt > 0 ? 'dash-tile--active' : ''}" data-action="dash:support" role="button" tabindex="0">
          <div class="dash-tile__ic dash-tile__ic--cyan">${IC.videos}</div>
          ${openCnt > 0 ? `<div class="dash-badge dash-badge--cyan">${openCnt}</div>` : ''}
          <div class="dash-tile__value">${openCnt}</div>
          <div class="dash-tile__label">${t('open') || 'OFFENE VIDEOS'}</div>
          <div class="dash-tile__sub">${openCnt > 0 ? `${openCnt} ${t('dbSupOpen') || 'offen'}` : t('noOpen') || 'Keine offen'}</div>
        </div>

        <div class="dash-tile dash-tile--post" data-action="post:open" role="button" tabindex="0">
          <div class="dash-tile__ic dash-tile__ic--violet">${IC.post}</div>
          <div class="dash-tile__value">${myVids}</div>
          <div class="dash-tile__label">${t('postBtn') || 'VIDEO POSTEN'}</div>
          <div class="dash-tile__sub">${myVids === 0 ? (t('noMy') || 'Noch kein Video') : `${myVids} aktiv`}</div>
        </div>

      </div>

      <!-- Row 2: Guthaben + Profil (LARGE) -->
      <div class="dash-row">

        <div class="dash-tile dash-tile--balance ${balance < 0 ? 'dash-tile--alert' : ''}" data-action="dash:guthaben" role="button" tabindex="0">
          <div class="dash-tile__ic dash-tile__ic--gold">${IC.balance}</div>
          ${balance < 0 ? `<div class="dash-badge dash-badge--red">!</div>` : ''}
          <div class="dash-tile__value" style="color:${balColor}">${balance >= 0 ? '+' : ''}${balance}</div>
          <div class="dash-tile__label">${t('balance') || 'GUTHABEN'}</div>
          <div class="dash-tile__meta"><span>↑${given}</span><span>↓${received}</span></div>
        </div>

        <div class="dash-tile dash-tile--profile" data-action="nav:goto" data-screen="profile" role="button" tabindex="0">
          <div class="dash-tile__ic dash-tile__ic--lila">${IC.profile}</div>
          ${unreadNotifs > 0 ? `<div class="dash-badge dash-badge--red">${unreadNotifs}</div>` : ''}
          <div class="dash-tile__value">${unreadNotifs > 0 ? unreadNotifs : weeklyGiven}</div>
          <div class="dash-tile__label">${t('navProfile') || 'PROFIL'}</div>
          <div class="dash-tile__sub">${unreadNotifs > 0 ? (t('notifs') || '🔔 Neu') : `${weeklyGiven} ${t('given') || 'gegeben'}`}</div>
        </div>

      </div>

      <!-- Row 3: 4 kleine Kacheln (2×2) -->
      <div class="dash-row dash-row--sm">

        <div class="dash-tile dash-tile--myvideos" data-action="nav:goto" data-screen="myvideos" role="button" tabindex="0">
          <div class="dash-tile__ic dash-tile__ic--blue">${IC.myvideos}</div>
          <div class="dash-tile__value">${myVids}</div>
          <div class="dash-tile__label">${t('dashTileVideos') || 'VIDEOS'}</div>
          <div class="dash-tile__sub">${myVids > 0 ? `${myVids} aktiv` : t('noMy') || 'Noch kein Video'}</div>
        </div>

        <div class="dash-tile dash-tile--caption" data-action="nav:goto" data-screen="caption" role="button" tabindex="0">
          <div class="dash-tile__ic dash-tile__ic--pink">${IC.caption}</div>
          <div class="dash-tile__value"></div>
          <div class="dash-tile__label">${t('dashTileCaption') || 'BEITRÄGE'}</div>
          <div class="dash-tile__sub">${t('capTileSub') || 'Text generieren'}</div>
        </div>

        <div class="dash-tile dash-tile--settings" data-action="nav:goto" data-screen="settings" role="button" tabindex="0">
          <div class="dash-tile__ic dash-tile__ic--gray">${IC.settings}</div>
          <div class="dash-tile__value"></div>
          <div class="dash-tile__label">${t('dashTileSettings') || 'EINSTELLUNGEN'}</div>
          <div class="dash-tile__sub">${t('settingsSub') || 'App anpassen'}</div>
        </div>

        ${isAdmin ? `
        <div class="dash-tile dash-tile--admin" data-action="nav:goto" data-screen="admin" role="button" tabindex="0">
          <div class="dash-tile__ic dash-tile__ic--darkviolet">${IC.admin}</div>
          <div class="dash-tile__value">${Object.keys(state.db.members || {}).length}</div>
          <div class="dash-tile__label">${t('adminPanel') || 'ADMIN'}</div>
          <div class="dash-tile__sub">Panel öffnen</div>
        </div>` : `
        <div class="dash-tile dash-tile--weekly" data-action="dash:leaderboard" role="button" tabindex="0">
          <div class="dash-tile__ic dash-tile__ic--gray">${IC.weekly}</div>
          <div class="dash-tile__value" style="font-size:var(--text-xl)">${weeklyGiven}</div>
          <div class="dash-tile__label">${t('dashTileActivity') || 'AKTIVITÄT'}</div>
          <div class="dash-tile__sub">${t('given') || 'gegeben'}</div>
        </div>`}

      </div>

    </div>
  `;

  _registerHandlers();
}

function _registerHandlers() {
  on('dash:guthaben', () => {
    import('./home.js').then(m => { m.setMode?.('balance'); goScreen('home'); });
  });
  on('dash:support', () => {
    import('./home.js').then(m => { m.setMode?.('feed'); goScreen('home'); });
  });
  on('dash:leaderboard', () => {
    import('./home.js').then(m => { m.setMode?.('leaderboard'); goScreen('home'); });
  });
}
