/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Profile Screen
   ═══════════════════════════════════════════════════════ */

import { state }       from '../state.js';
import { t }           from '../i18n.js';
import { esc, timeAgo, avatarGradient } from '../utils.js';
import { on }          from '../events.js';
import { toast }       from '../components/toast.js';
import { writeDB }     from '../firebase.js';

const RANKS = [
  { min: 0,   max: 4,   label: 'Neuling',    stars: '🏆',           color: '#94a3b8' },
  { min: 5,   max: 19,  label: 'Aufsteiger', stars: '🏆🏆',        color: '#22d3ee' },
  { min: 20,  max: 49,  label: 'Aktiv',      stars: '🏆🏆🏆',      color: '#7c3aed' },
  { min: 50,  max: 99,  label: 'Veteran',    stars: '🏆🏆🏆🏆',    color: '#f59e0b' },
  { min: 100, max: Infinity, label: 'Elite', stars: '🏆🏆🏆🏆🏆', color: '#f43f5e' },
];

function rankFor(u) {
  const given = u.stats?.given || 0;
  return RANKS.find(r => given >= r.min && given <= r.max) || RANKS[0];
}

export function render() {
  const el = document.getElementById('screen-profile');
  if (!el) return;

  const cu = state.currentUser;
  if (!cu || !state.db.members?.[cu]) return;

  const u       = state.db.members[cu];
  const stats   = u.stats || {};
  const given   = stats.given    || 0;
  const received= stats.received || 0;
  const rank    = rankFor(u);
  const daysIn  = u.joined ? Math.max(0, Math.floor((Date.now() - u.joined) / 86400000)) : 0;
  const initial = (cu || '?').slice(0, 2).toUpperCase();
  const gradient= avatarGradient(cu);

  const notifs  = _getNotifs(cu);
  const unread  = notifs.filter(m => !m.read).length;

  // Build streak dots (last 7 days)
  const streakDots = _buildStreakDots(u);

  el.innerHTML = `
    <div class="profile-scroll">

      <!-- Hero -->
      <div class="profile-hero">
        <div class="profile-avatar" style="background:${gradient}">${initial}
          <div class="profile-rank-badge">${rank.stars}</div>
        </div>
        <div class="profile-name">${esc(u.name || cu)}</div>
        <div class="profile-since">📅 ${daysIn} ${t('streakDays') || 'Tage'} ${t('inPool') || 'im Support Pool'}</div>
        <div class="profile-stats-row">
          <div class="profile-stat">
            <div class="profile-stat__num">${given}</div>
            <div class="profile-stat__label">${t('pGiven') || t('given')}</div>
          </div>
          <div class="profile-stat">
            <div class="profile-stat__num">${received}</div>
            <div class="profile-stat__label">${t('pRecv') || t('recv')}</div>
          </div>
          <div class="profile-stat">
            <div class="profile-stat__num">${u.postsTotal || 0}</div>
            <div class="profile-stat__label">${t('pVids') || t('vids')}</div>
          </div>
        </div>
      </div>

      <!-- Streak -->
      <div class="section">
        <div class="section-title">🔥 Aktivitäts-Streak</div>
        <div class="streak-row">${streakDots}</div>
      </div>

      <!-- Profile Check CTA -->
      <div class="section">
        <button class="btn btn--gold btn--full" data-action="profile:check">
          ${t('profCheckBtn') || 'Check mein Profil'}
        </button>
      </div>

      <!-- Settings & Logout -->
      <div class="section">
        <div style="display:flex;gap:10px">
          <button class="btn btn--ghost btn--full" data-action="modal:settings" style="flex:1">
            ⚙️ ${t('settings') || 'Einstellungen'}
          </button>
          <button class="btn btn--danger" data-action="settings:logout" style="flex:1">
            ${t('logout') || 'Abmelden'}
          </button>
        </div>
      </div>

      <!-- Notifications -->
      <div class="section">
        <div class="section-title">
          ${t('notifs') || '🔔 Benachrichtigungen'}
          ${unread > 0 ? `<span class="badge badge--danger" style="margin-left:8px">${unread}</span>` : ''}
        </div>
        <div class="notif-hint">${t('notifsHint') || '💡 Benachrichtigungen mit 🗑 löschen'}</div>
        <div id="notif-list">
          ${_renderNotifList(notifs, cu)}
        </div>
      </div>

    </div>
  `;

  // Mark all as read after render
  _markAllRead(cu, notifs);

  _registerHandlers();
}

function _getNotifs(cu) {
  return Object.entries(state.db.messages || {})
    .filter(([, m]) => m.to === cu && (m.type === 'notif' || m.type === 'dm' || m.reply))
    .map(([id, m]) => ({ ...m, _id: id }))
    .sort((a, b) => (b.ts || b.timestamp || 0) - (a.ts || a.timestamp || 0))
    .slice(0, 30);
}

function _renderNotifList(notifs, cu) {
  if (!notifs.length) {
    return `<div class="empty-state">
      <div class="empty-state__icon">🔔</div>
      <div class="empty-state__text">${t('noNotif') || 'Keine Benachrichtigungen'}</div>
    </div>`;
  }
  return notifs.map(m => {
    const mid       = m._id;
    const fromKey   = m.from || null;
    const fromName  = fromKey && state.db.members?.[fromKey]
      ? (state.db.members[fromKey].name || fromKey) : (fromKey || '');
    const msg       = m.message || m.text || '';
    const quote     = m.inReplyTo || null;
    const unreadCls = m.read ? '' : ' notif-item--unread';

    return `<div class="list-item${unreadCls}" data-notif-id="${esc(mid)}">
      <div class="list-item__icon">${m.icon || '📩'}</div>
      <div class="list-item__body">
        ${fromKey ? `<div class="list-item__title">@${esc(fromName || fromKey)}</div>` : ''}
        ${quote   ? `<div class="list-item__quote">↩ "${esc(quote)}"</div>` : ''}
        <div class="list-item__sub">${esc(msg)}</div>
        ${m.ts ? `<div class="list-item__time">${timeAgo(m.ts, state.lang)}</div>` : ''}
        ${fromKey && fromKey !== cu ? `<button class="btn btn--ghost btn--sm" data-action="notif:reply" data-from="${esc(fromKey)}" data-id="${esc(mid)}">↩ @${esc(fromName || fromKey)}</button>` : ''}
      </div>
      <button class="btn btn--ghost btn--icon" data-action="notif:del" data-id="${esc(mid)}" aria-label="Delete notification">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>`;
  }).join('');
}

function _buildStreakDots(u) {
  const today = new Date();
  const dots = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const active = (u.supportDays || []).includes(key) ||
                   (u.activeDays  || []).includes(key);
    const dayLabel = ['So','Mo','Di','Mi','Do','Fr','Sa'][d.getDay()];
    dots.push(`<div class="streak-dot ${active ? 'streak-dot--active' : ''}">
      <div class="streak-dot__circle"></div>
      <div class="streak-dot__day">${dayLabel}</div>
    </div>`);
  }
  return dots.join('');
}

function _markAllRead(cu, notifs) {
  const unread = notifs.filter(m => !m.read);
  if (!unread.length) return;
  unread.forEach(m => {
    writeDB(`messages/${m._id}/read`, true);
  });
}

function _registerHandlers() {
  on('notif:del', (el) => {
    const id = el.dataset.id;
    if (!id) return;
    const item = el.closest('.list-item');
    if (item) {
      item.style.opacity = '0';
      item.style.transform = 'translateX(50px)';
      item.style.transition = 'all .25s ease';
      setTimeout(() => item.remove(), 250);
    }
    writeDB(`messages/${id}`, null);
    toast('🗑️ Gelöscht', 'success', 1800);
  });

  on('notif:reply', (el) => {
    const fromKey = el.dataset.from;
    if (!fromKey) return;
    import('../features/notifications.js').then(m => m.openReply(fromKey));
  });
}
