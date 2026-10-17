/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Dashboard Screen (Bento redesign)
   ═══════════════════════════════════════════════════════ */

import { state }       from '../state.js';
import { t }           from '../i18n.js';
import { goScreen }    from '../router.js';
import { on }          from '../events.js';

const R1_NEED = 10;
const R2_NEED = 10;

function _rankIcon(given) {
  if (given >= 100) return '👑';
  if (given >= 50)  return '🏆';
  if (given >= 20)  return '🔥';
  if (given >= 5)   return '⚡';
  return '🌱';
}

function _boostRemaining(myKey) {
  let min = Infinity;
  Object.values(state.db.videos || {}).forEach(v => {
    if ((v.ownerKey || v.owner || '').toLowerCase() !== myKey) return;
    if (v.status === 'done' || v.status === 'expired') return;
    const exp = v.expiresR1 || 0;
    if (exp > Date.now() && exp < min) min = exp;
  });
  if (min === Infinity) return null;
  const diff = Math.max(0, min - Date.now());
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(mins / 60);
  return hrs > 0 ? `${hrs}h ${mins % 60}min` : `${mins}min`;
}

// ── Lucide-style SVG icons ────────────────────────────────
const IC = {
  videos:   `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>`,
  post:     `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
  balance:  `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  profile:  `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  myvideos: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>`,
  urgent:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
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

  const now = Date.now();
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  const urgentCnt = Object.values(state.db.videos || {}).filter(v => {
    if (v.status === 'done' || v.status === 'expired') return false;
    if ((v.ownerKey || v.owner || '').toLowerCase() === myKey) return false;
    if (!v.expiresR1 || v.expiresR1 < now || v.expiresR1 - now > TWO_HOURS) return false;
    const r1 = (v.r1Supporters || []).map(k => k.toLowerCase());
    if (r1.includes(myKey)) return false;
    if ((v.round || 1) === 1 && r1.length >= (v.r1Need || R1_NEED)) return false;
    return true;
  }).length;

  const realBalance = given - received;
  const balColor    = realBalance >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)';
  const myVids      = Object.values(state.db.videos || {}).filter(v =>
    (v.ownerKey || v.owner || '').toLowerCase() === myKey
  ).length;
  const rankIcon    = _rankIcon(given);
  const boostTimer  = _boostRemaining(myKey);
  const delay       = (n) => `style="animation-delay:${n * 50}ms"`;

  el.innerHTML = `
    <div class="page-header">
      <div class="page-header__title">Dashboard</div>
    </div>
    <div class="dash-scroll">

      <!-- Section label: Hauptaktionen -->
      <div class="dash-section-label">
        <span class="dash-section-label__text">🔥 ${t('dashActions') || 'HAUPTAKTIONEN'}</span>
        ${openCnt > 0 ? `<span class="dash-section-label__badge">${openCnt}</span>` : ''}
      </div>

      <!-- Row 1: Offene Videos + Video posten (LARGE) -->
      <div class="dash-row">

        <div class="dash-tile dash-tile--support dash-tile--hero ${openCnt > 0 ? 'dash-tile--active' : ''}"
          data-action="dash:support" role="button" tabindex="0" ${delay(0)}>
          <div class="dash-tile__ic dash-tile__ic--cyan">${IC.videos}</div>
          ${openCnt > 0 ? `<div class="dash-badge dash-badge--cyan">${openCnt}</div>` : ''}
          <div class="dash-tile__value">${openCnt}</div>
          <div class="dash-tile__label">${t('open') || 'OFFENE VIDEOS'}</div>
          <div class="dash-tile__sub">${openCnt > 0 ? `${openCnt} ${t('dbSupOpen') || 'offen'}` : t('noOpen') || 'Keine offen'}</div>
        </div>

        <div class="dash-tile dash-tile--post dash-tile--hero" data-action="post:open" role="button" tabindex="0" ${delay(1)}>
          <div class="dash-tile__ic dash-tile__ic--violet">${IC.post}</div>
          <div class="dash-tile__value">${myVids}</div>
          <div class="dash-tile__label">${t('postBtn') || 'VIDEO POSTEN'}</div>
          <div class="dash-tile__sub">${boostTimer
            ? `${t('dashBoost') || 'Boost läuft'} ${boostTimer}`
            : myVids === 0 ? (t('noMy') || 'Noch kein Video') : `${myVids} ${t('dashTileActivity') ? '' : 'aktiv'}`
          }</div>
        </div>

      </div>

      <!-- Divider: Dein Konto -->
      <div class="dash-divider">
        <div class="dash-divider__line"></div>
        <div class="dash-divider__label">↓ ${t('dashAccount') || 'DEIN KONTO'} ↓</div>
        <div class="dash-divider__line"></div>
      </div>

      <!-- Row 2: Guthaben + Profil (LARGE) -->
      <div class="dash-row">

        <div class="dash-tile dash-tile--balance ${realBalance < 0 ? 'dash-tile--alert' : ''}"
          data-action="dash:guthaben" role="button" tabindex="0" ${delay(2)}>
          <div class="dash-tile__ic dash-tile__ic--gold">${IC.balance}</div>
          ${realBalance < 0 ? `<div class="dash-badge dash-badge--red">!</div>` : ''}
          <div class="dash-tile__value" style="color:${balColor}">${realBalance >= 0 ? '+' : ''}${realBalance}</div>
          <div class="dash-tile__label">${t('balance') || 'GUTHABEN'}</div>
          <div class="dash-tile__meta"><span>↑${given}</span><span>↓${received}</span></div>
        </div>

        <div class="dash-tile dash-tile--profile" data-action="nav:goto" data-screen="profile"
          role="button" tabindex="0" ${delay(3)}>
          <div class="dash-tile__ic dash-tile__ic--lila">${IC.profile}</div>
          <div class="dash-tile__value">${rankIcon}</div>
          <div class="dash-tile__label">${t('navProfile') || 'PROFIL'}</div>
          <div class="dash-tile__sub">${given} ${t('given') || 'gegeben'} · ${t('wkLabel') || 'Woche'}: ${weeklyGiven}</div>
        </div>

      </div>

      <!-- Row 3: 4 kleine Kacheln (2×2) -->
      <div class="dash-row dash-row--sm">

        <div class="dash-tile dash-tile--myvideos ${unreadNotifs > 0 ? 'dash-tile--active' : ''}"
          data-action="nav:goto" data-screen="myvideos" role="button" tabindex="0" ${delay(4)}>
          <div class="dash-tile__ic dash-tile__ic--blue">${IC.myvideos}</div>
          ${unreadNotifs > 0 ? `<div class="dash-badge dash-badge--red">${unreadNotifs}</div>` : ''}
          <div class="dash-tile__value">${myVids}</div>
          <div class="dash-tile__label">${t('dashTileVideos') || 'VIDEOS'}</div>
          <div class="dash-tile__sub">${unreadNotifs > 0 ? `${unreadNotifs} ${t('notifs') || 'neu'}` : myVids > 0 ? `${myVids} ${t('active') || 'aktiv'}` : t('noMy') || 'Noch kein Video'}</div>
        </div>

        <div class="dash-tile dash-tile--urgent ${urgentCnt > 0 ? 'dash-tile--active' : ''}"
          data-action="dash:urgent" role="button" tabindex="0" ${delay(5)}>
          <div class="dash-tile__ic dash-tile__ic--amber">${IC.urgent}</div>
          ${urgentCnt > 0 ? `<div class="dash-badge dash-badge--red">${urgentCnt}</div>` : ''}
          <div class="dash-tile__value">${urgentCnt}</div>
          <div class="dash-tile__label">${t('dashTileUrgent') || 'DRINGEND'}</div>
          <div class="dash-tile__sub">${urgentCnt > 0 ? `${urgentCnt} ${t('urgentSub') || 'läuft bald ab'}` : t('noUrgent') || 'Alles gut ✓'}</div>
        </div>

        <div class="dash-tile dash-tile--settings" data-action="nav:goto" data-screen="settings"
          role="button" tabindex="0" ${delay(6)}>
          <div class="dash-tile__ic dash-tile__ic--gray">${IC.settings}</div>
          <div class="dash-tile__value" style="font-size:var(--text-xl)">⚙</div>
          <div class="dash-tile__label">${t('dashTileSettings') || 'EINSTELLUNGEN'}</div>
          <div class="dash-tile__sub">${t('settingsSub') || 'App anpassen'}</div>
        </div>

        ${isAdmin ? `
        <div class="dash-tile dash-tile--admin" data-action="nav:goto" data-screen="admin"
          role="button" tabindex="0" ${delay(7)}>
          <div class="dash-tile__ic dash-tile__ic--darkviolet">${IC.admin}</div>
          <div class="dash-tile__value">${Object.keys(state.db.members || {}).length}</div>
          <div class="dash-tile__label">${t('adminPanel') || 'ADMIN'}</div>
          <div class="dash-tile__sub">${t('adminPanelOpen') || 'Panel öffnen'}</div>
        </div>` : `
        <div class="dash-tile dash-tile--weekly" data-action="dash:leaderboard"
          role="button" tabindex="0" ${delay(7)}>
          <div class="dash-tile__ic dash-tile__ic--gray">${IC.weekly}</div>
          <div class="dash-tile__value" style="font-size:var(--text-xl)">${weeklyGiven}</div>
          <div class="dash-tile__label">${t('dashTileActivity') || 'AKTIVITÄT'}</div>
          <div class="dash-tile__sub">${weeklyGiven} ${t('given') || 'gegeben'}</div>
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
  on('dash:urgent', () => {
    import('./home.js').then(m => { m.setMode?.('feed'); goScreen('home'); });
  });
}
