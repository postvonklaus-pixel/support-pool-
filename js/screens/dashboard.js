/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Dashboard Screen
   ═══════════════════════════════════════════════════════ */

import { state }       from '../state.js';
import { t }           from '../i18n.js';
import { esc }         from '../utils.js';
import { goScreen }    from '../router.js';
import { on }          from '../events.js';

const R1_NEED = 10;
const R2_NEED = 10;

export function render() {
  const el = document.getElementById('screen-dashboard');
  if (!el) return;

  const cu = state.currentUser;
  if (!cu || !state.db.members?.[cu]) return;

  const u       = state.db.members[cu];
  const stats   = u.stats || {};
  const given   = stats.given    || 0;
  const received= stats.received || 0;
  const balance = Math.min(given - received, 20);
  const myVids  = u.postsTotal || (u.myVideos ? Object.keys(u.myVideos).length : 0);
  const myKey   = cu.toLowerCase();

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

  const balColor  = balance >= 0 ? 'var(--success)' : 'var(--danger)';
  const isAdmin   = u.role === 'admin';
  const weeklyGiven = u.weeklyGiven || 0;

  el.innerHTML = `
    <div class="page-header">
      <div class="page-header__title">Dashboard</div>
    </div>
    <div class="dash-scroll">

      <!-- Row 1: Balance + Support open -->
      <div class="dash-row">
        <!-- Balance tile -->
        <div class="dash-tile dash-tile--balance ${balance < 0 ? 'dash-tile--alert' : ''}" data-action="dash:guthaben" role="button">
          ${balance < 0 ? '<div class="dash-badge">!</div>' : ''}
          <div class="dash-tile__emoji">💰</div>
          <div class="dash-tile__main" style="color:${balColor}">${balance}</div>
          <div class="dash-tile__label">${t('balance')}</div>
          <div class="dash-tile__meta">
            <span>↑${given}</span><span>↓${received}</span>
          </div>
        </div>

        <!-- Support tile -->
        <div class="dash-tile dash-tile--support ${openCnt > 0 ? 'dash-tile--active' : ''}" data-action="dash:support" role="button">
          ${openCnt > 0 ? `<div class="dash-badge dash-badge--blue">${openCnt}</div>` : ''}
          <div class="dash-tile__emoji">🎯</div>
          <div class="dash-tile__main">${openCnt}</div>
          <div class="dash-tile__label">${t('open')}</div>
          <div class="dash-tile__sub">${openCnt > 0 ? `${openCnt} ${t('dbSupOpen') || 'offen'}` : t('noOpen')}</div>
        </div>
      </div>

      <!-- Row 2: Post Video + Profile -->
      <div class="dash-row">
        <!-- Post tile -->
        <div class="dash-tile dash-tile--post ${myVids === 0 ? 'dash-tile--active' : ''}" data-action="post:open" role="button">
          <div class="dash-tile__emoji">🎬</div>
          <div class="dash-tile__main">${myVids}</div>
          <div class="dash-tile__label">${t('postBtn')}</div>
          <div class="dash-tile__sub">${myVids === 1 ? `1 ${t('vids')} aktiv` : myVids > 1 ? `${myVids} ${t('vids')} aktiv` : t('noMy')}</div>
        </div>

        <!-- Profile tile -->
        <div class="dash-tile dash-tile--profile" data-action="nav:goto" data-screen="profile" role="button">
          ${unreadNotifs > 0 ? '<div class="dash-bell">🔔</div>' : ''}
          <div class="dash-tile__emoji">🏆</div>
          <div class="dash-tile__main">${unreadNotifs > 0 ? unreadNotifs : ''}</div>
          <div class="dash-tile__label">${t('navProfile')}</div>
          <div class="dash-tile__sub">${unreadNotifs > 0 ? t('notifs') : (t('weeklySupLabel') || `${weeklyGiven} ${t('given')}`)}</div>
        </div>
      </div>

      <!-- Row 3: My Videos + Caption -->
      <div class="dash-row">
        <div class="dash-tile dash-tile--myvideos" data-action="nav:goto" data-screen="myvideos" role="button">
          <div class="dash-tile__emoji">🎞️</div>
          <div class="dash-tile__label">${t('myVidsTile') || '🎞️ Meine Videos'}</div>
        </div>

        <div class="dash-tile dash-tile--caption" data-action="nav:goto" data-screen="caption" role="button">
          <div class="dash-tile__emoji">✍️</div>
          <div class="dash-tile__label">${t('capTileLabel') || 'Caption Generator'}</div>
          <div class="dash-tile__sub">${t('capTileSub') || 'Hashtags & Hook-Formeln'}</div>
        </div>
      </div>

      <!-- Row 4: Settings + Admin (if admin) -->
      <div class="dash-row">
        <div class="dash-tile dash-tile--settings" data-action="nav:goto" data-screen="settings" role="button">
          <div class="dash-tile__emoji">⚙️</div>
          <div class="dash-tile__label">${t('settings')}</div>
        </div>

        ${isAdmin ? `
        <div class="dash-tile dash-tile--admin" data-action="nav:goto" data-screen="admin" role="button">
          <div class="dash-tile__emoji">🔑</div>
          <div class="dash-tile__label">${t('adminPanel') || 'Admin-Bereich'}</div>
        </div>` : `
        <div class="dash-tile dash-tile--weekly" data-action="dash:leaderboard" role="button">
          <div class="dash-tile__emoji">📊</div>
          <div class="dash-tile__main">${weeklyGiven}</div>
          <div class="dash-tile__label">${t('weeklySupLabel') || 'Diese Woche'}</div>
        </div>`}
      </div>

    </div>
  `;

  _registerHandlers();
}

function _registerHandlers() {
  on('dash:guthaben', () => {
    import('./home.js').then(m => {
      goScreen('home');
      m.setMode && m.setMode('guthaben');
    });
  });

  on('dash:support', () => {
    import('./home.js').then(m => {
      goScreen('home');
      m.setMode && m.setMode('support');
    });
  });

  on('dash:leaderboard', () => {
    import('./home.js').then(m => {
      goScreen('home');
      m.setMode && m.setMode('leaderboard');
    });
  });
}
