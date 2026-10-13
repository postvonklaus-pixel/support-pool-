/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Admin Screen
   ═══════════════════════════════════════════════════════ */

import { state }   from '../state.js';
import { t }       from '../i18n.js';
import { esc }     from '../utils.js';
import { on }      from '../events.js';
import { writeDB } from '../firebase.js';
import { toast }   from '../components/toast.js';
import { confirm } from '../components/modal.js';

let _tab = 'overview';

export function render() {
  const el = document.getElementById('screen-admin');
  if (!el) return;

  const cu = state.currentUser;
  if (!cu || state.db.members?.[cu]?.role !== 'admin') {
    el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">🔒</div><div class="empty-state__title">Kein Zugriff</div></div>`;
    return;
  }

  el.innerHTML = `
    <div class="page-header">
      <div class="page-header__title">${t('adminPanel') || 'Admin-Bereich'}</div>
    </div>
    <div class="admin-tab-bar">
      <button class="admin-tab ${_tab==='overview'?'admin-tab--active':''}" data-action="admin:tab" data-tab="overview">Übersicht</button>
      <button class="admin-tab ${_tab==='members'?'admin-tab--active':''}" data-action="admin:tab" data-tab="members">Mitglieder</button>
      <button class="admin-tab ${_tab==='videos'?'admin-tab--active':''}" data-action="admin:tab" data-tab="videos">Videos</button>
      <button class="admin-tab ${_tab==='broadcast'?'admin-tab--active':''}" data-action="admin:tab" data-tab="broadcast">Broadcast</button>
    </div>
    <div class="admin-content">
      ${_tab === 'overview'  ? _renderOverview()  : ''}
      ${_tab === 'members'   ? _renderMembers()   : ''}
      ${_tab === 'videos'    ? _renderVideos()    : ''}
      ${_tab === 'broadcast' ? _renderBroadcast() : ''}
    </div>
  `;

  _registerHandlers();
}

export function switchAdminTab(tab) {
  _tab = tab || 'overview';
  render();
}

// ── Overview ──────────────────────────────────────────────
function _renderOverview() {
  const members = Object.values(state.db.members || {});
  const active  = members.filter(m => m.status === 'active' && m.role !== 'admin').length;
  const groups  = Object.keys(state.db.groups || {}).length;
  const videos  = Object.keys(state.db.videos || {}).length;
  const open    = Object.values(state.db.videos || {}).filter(v => v.status !== 'done' && v.status !== 'expired').length;

  return `<div class="bento-grid">
    ${_statCard('👥', active, 'Aktive Mitglieder')}
    ${_statCard('🏠', groups, 'Gruppen')}
    ${_statCard('🎬', videos, 'Videos gesamt')}
    ${_statCard('🎯', open, 'Videos offen')}
  </div>`;
}

function _statCard(emoji, num, label) {
  return `<div class="card card--glass" style="padding:20px;text-align:center">
    <div style="font-size:28px">${emoji}</div>
    <div style="font-size:32px;font-weight:800;color:var(--accent-primary)">${num}</div>
    <div style="font-size:12px;color:var(--text-secondary)">${label}</div>
  </div>`;
}

// ── Members ───────────────────────────────────────────────
function _renderMembers() {
  const members = Object.entries(state.db.members || {})
    .filter(([, m]) => m.status === 'active')
    .sort((a, b) => (b[1].stats?.given || 0) - (a[1].stats?.given || 0));

  if (!members.length) return `<div class="empty-state"><div class="empty-state__sub">Keine Mitglieder</div></div>`;

  // Group by group
  const groups = state.db.groups || {};
  const grouped = {};
  const ungrouped = [];

  members.forEach(([key, m]) => {
    let found = false;
    Object.values(groups).forEach(g => {
      if ((g.members || []).includes(key)) { grouped[g.id] = grouped[g.id] || []; grouped[g.id].push([key, m]); found = true; }
    });
    if (!found) ungrouped.push([key, m]);
  });

  let html = '';
  Object.values(groups).sort((a, b) => a.number - b.number).forEach(g => {
    const gMembers = grouped[g.id] || [];
    if (!gMembers.length) return;
    html += `<div class="admin-group">
      <div class="admin-group__header" data-action="admin:group:toggle" data-group="${esc(g.id)}">
        <span>${esc(g.name)}</span>
        <span class="badge badge--primary">${gMembers.length}</span>
      </div>
      <div class="admin-group__body">
        ${gMembers.map(([k, m]) => _memberRow(k, m)).join('')}
      </div>
    </div>`;
  });

  if (ungrouped.length) {
    html += `<div class="admin-group">
      <div class="admin-group__header"><span>Ohne Gruppe</span><span class="badge">${ungrouped.length}</span></div>
      <div class="admin-group__body">${ungrouped.map(([k, m]) => _memberRow(k, m)).join('')}</div>
    </div>`;
  }

  return html;
}

function _memberRow(key, m) {
  const bal   = (m.stats?.given || 0) - (m.stats?.received || 0);
  const color = bal > 0 ? 'var(--success)' : bal < 0 ? 'var(--danger)' : 'var(--text-secondary)';
  return `<div class="list-item">
    <div class="list-item__icon">${(key||'?').slice(0,2).toUpperCase()}</div>
    <div class="list-item__body">
      <div class="list-item__title">${esc(m.name || key)}${m.role==='admin'?' 👑':''}</div>
      <div class="list-item__sub">G:${m.stats?.given||0} / R:${m.stats?.received||0}</div>
    </div>
    <div class="list-item__aside" style="color:${color};font-weight:700">${bal > 0 ? '+' : ''}${bal}</div>
  </div>`;
}

// ── Videos ────────────────────────────────────────────────
function _renderVideos() {
  const videos = Object.entries(state.db.videos || {})
    .sort(([,a],[,b]) => (b.postedAt||b.ts||0) - (a.postedAt||a.ts||0))
    .slice(0, 30);

  if (!videos.length) return `<div class="empty-state"><div class="empty-state__sub">Keine Videos</div></div>`;

  return videos.map(([id, v]) => {
    const owner = v.ownerKey || v.owner || '?';
    const link  = v.link || v.url || '';
    const isDone= v.status === 'done';

    return `<div class="list-item">
      <div class="list-item__body">
        <div class="list-item__title">@${esc(owner)}</div>
        <div class="list-item__sub truncate">${esc(link.slice(0,40))}</div>
      </div>
      <div class="list-item__aside">
        <span class="badge ${isDone?'badge--success':'badge--primary'}" style="margin-bottom:4px">R${v.round||1}</span>
        <button class="btn btn--danger btn--icon btn--sm" data-action="admin:vid:delete" data-vid-id="${esc(id)}" aria-label="Delete">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
}

// ── Broadcast ─────────────────────────────────────────────
function _renderBroadcast() {
  const cur = state.db.settings?.broadcast || '';
  const active = state.db.settings?.broadcastActive || false;

  return `<div class="card card--glass" style="padding:20px">
    <label class="input-label">Broadcast-Nachricht</label>
    <textarea id="broadcast-text" class="textarea" rows="3" placeholder="Nachricht...">${esc(cur)}</textarea>
    <div style="display:flex;gap:10px;margin-top:12px">
      <button class="btn btn--primary btn--sm" data-action="admin:bc:save">💾 Speichern</button>
      <button class="btn ${active?'btn--danger':'btn--secondary'} btn--sm" data-action="admin:bc:toggle">
        ${active ? '⏹ Deaktivieren' : '▶ Aktivieren'}
      </button>
    </div>
  </div>`;
}

// ── Handlers ──────────────────────────────────────────────
function _registerHandlers() {
  on('admin:tab', (el) => {
    _tab = el.dataset.tab || 'overview';
    render();
  });

  on('admin:group:toggle', (el) => {
    const body = el.closest('.admin-group')?.querySelector('.admin-group__body');
    if (body) body.classList.toggle('hidden');
  });

  on('admin:vid:delete', async (el) => {
    const id = el.dataset.vidId;
    if (!id) return;
    const ok = await confirm('Video löschen?', 'Das Video wird endgültig entfernt.');
    if (!ok) return;
    writeDB(`videos/${id}`, null);
    toast('Video gelöscht', 'success');
    setTimeout(render, 300);
  });

  on('admin:bc:save', () => {
    const text = document.getElementById('broadcast-text')?.value || '';
    writeDB('settings/broadcast', text);
    toast('Gespeichert ✓', 'success');
  });

  on('admin:bc:toggle', () => {
    const active = state.db.settings?.broadcastActive || false;
    writeDB('settings/broadcastActive', !active);
    toast(!active ? 'Broadcast aktiv ✓' : 'Broadcast deaktiviert', 'success');
    setTimeout(render, 300);
  });
}
