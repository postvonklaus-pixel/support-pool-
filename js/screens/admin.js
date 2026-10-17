/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Admin Screen  (Part F)
   ═══════════════════════════════════════════════════════ */

import { state }   from '../state.js';
import { t }       from '../i18n.js';
import { esc, avatarGradient, timeAgo } from '../utils.js';
import { on }      from '../events.js';
import { writeDB } from '../firebase.js';
import { toast }   from '../components/toast.js';
import { confirm, openModal, closeModal } from '../components/modal.js';
import { getTemplates, TEMPLATES } from '../features/adminTemplates.js';
import { progressRing } from '../components/progress.js';
import { renderFairnessMeter } from '../features/fairnessMeter.js';

const TABS = ['overview', 'members', 'templates', 'videos', 'broadcast', 'groups', 'messages'];
let _tab          = 'overview';
let _memberSearch = '';
let _skipBcEcho   = false;
let _balAdjKey    = null;  // key of member being balance-adjusted
let _adminViewAs  = null;  // original admin key during impersonation

// ── Admin auth guard ───────────────────────────────────────
function _isAdmin(cu) {
  if (!cu) return false;
  const u = state.db.members?.[cu];
  if (!u || u.role !== 'admin') return false;
  return true;
}

export function render() {
  // Skip echo-render triggered by bc:save so textarea keeps focus
  if (_skipBcEcho && _tab === 'broadcast') { _skipBcEcho = false; return; }
  _skipBcEcho = false;

  const el = document.getElementById('screen-admin');
  if (!el) return;

  const cu = state.currentUser;
  if (!_isAdmin(cu)) {
    el.innerHTML = `
      <div class="admin-denied">
        <div class="admin-denied__icon">🔒</div>
        <div class="admin-denied__title">${t('adminDenied')}</div>
        <div class="admin-denied__sub">${t('adminDeniedSub')}</div>
      </div>`;
    return;
  }

  // Impersonation back bar (injected into body, persists across screens)
  _syncViewBar();

  el.innerHTML = `
    <div class="admin-tab-bar">
      ${TABS.map(tab => `
        <button class="admin-tab ${_tab===tab?'admin-tab--active':''}"
          data-action="admin:tab" data-tab="${tab}">
          ${_tabLabel(tab)}
        </button>
      `).join('')}
    </div>
    <div class="admin-content">
      ${_tab === 'overview'   ? _renderOverview()   : ''}
      ${_tab === 'members'    ? _renderMembers()    : ''}
      ${_tab === 'templates'  ? _renderTemplates()  : ''}
      ${_tab === 'videos'     ? _renderVideos()     : ''}
      ${_tab === 'broadcast'  ? _renderBroadcast()  : ''}
      ${_tab === 'groups'     ? _renderGroups()     : ''}
      ${_tab === 'messages'   ? _renderMessages()   : ''}
    </div>
  `;

  _registerHandlers();
}

export function switchAdminTab(tab) {
  if (TABS.includes(tab)) _tab = tab;
  render();
}

export function toggleGroupAccordion(groupId) {
  const body = document.querySelector(`.admin-group[data-gid="${CSS.escape(groupId)}"] .admin-group__body`);
  if (body) body.classList.toggle('hidden');
}

// ── Tab labels ─────────────────────────────────────────────
function _tabLabel(tab) {
  return {
    overview:   t('adminTabOverview'),
    members:    t('adminTabMembers'),
    templates:  t('adminTabTemplates') || 'Kommentare',
    videos:     t('videos') || 'Videos',
    broadcast:  t('adminTabBroadcast'),
    groups:     t('adminTabGroups'),
    messages:   t('weeklyMsgTitle') || 'Nachrichten',
  }[tab] || tab;
}

// ── Overview ───────────────────────────────────────────────
function _renderOverview() {
  const members  = Object.values(state.db.members || {});
  const active   = members.filter(m => m.status === 'active' && m.role !== 'admin').length;
  const online   = members.filter(m => m.online === true).length;
  const groups   = Object.keys(state.db.groups || {}).length;
  const allVids  = Object.values(state.db.videos || {});
  const openVids = allVids.filter(v => v.status !== 'done' && v.status !== 'expired').length;
  const totalMsg = Object.keys(state.db.messages || {}).length;
  const weeklyTotal = members.reduce((s, m) => s + (m.weeklyGiven || 0), 0);

  const topThisWeek = members
    .filter(m => (m.weeklyGiven || 0) > 0)
    .sort((a, b) => (b.weeklyGiven||0) - (a.weeklyGiven||0))
    .slice(0, 3);

  const doneVids = allVids.filter(v => v.status === 'done').length;
  const donePct  = allVids.length > 0 ? Math.round(doneVids / allVids.length * 100) : 0;

  return `
    <div class="admin-overview">
      <div class="admin-stat-grid">
        ${_kpi('👥', active, t('adminTabMembers'))}
        ${_kpi('🟢', online, 'Online')}
        ${_kpi('🎯', openVids, t('adminKpiOpen'))}
        ${_kpi('📊', weeklyTotal, t('adminKpiWeekly'))}
        ${_kpi('🏠', groups, t('adminTabGroups'))}
        ${_kpi('💬', totalMsg, t('adminKpiMessages'))}
      </div>

      <div class="admin-rings-row">
        ${progressRing(online, Math.max(active, 1), { label: 'Online', size: 64, color: 'var(--success, #10b981)' })}
        ${progressRing(doneVids, Math.max(allVids.length, 1), { label: 'Videos', size: 64, color: 'var(--accent-primary)' })}
        ${progressRing(weeklyTotal, Math.max(weeklyTotal, active * 5, 1), { label: 'Woche', size: 64, color: 'var(--accent-warning, #f59e0b)' })}
      </div>

      ${topThisWeek.length ? `
      <div class="admin-section">
        <div class="admin-section__title">🏆 ${t('adminTopWeek')}</div>
        ${topThisWeek.map((m, i) => {
          const medals = ['🥇','🥈','🥉'];
          const grad = avatarGradient(m.name || '?');
          return `<div class="admin-mini-row">
            <span>${medals[i]}</span>
            <div class="admin-mini-avatar" style="background:${grad}">${(m.name||'?').slice(0,2).toUpperCase()}</div>
            <span class="admin-mini-name">${esc(m.name||'?')}</span>
            <span class="admin-mini-score">${m.weeklyGiven||0}</span>
          </div>`;
        }).join('')}
      </div>` : ''}

      <div class="admin-section">
        ${renderFairnessMeter()}
      </div>

      <div class="admin-section">
        <div class="admin-section__title">⚡ ${t('adminActionsTitle')}</div>
        <div class="admin-actions-row">
          <button class="btn btn--ghost btn--sm" data-action="admin:week:reset">🔄 ${t('adminWeekResetBtn')}</button>
          <button class="btn btn--ghost btn--sm" data-action="admin:vid:cleanup">🧹 ${t('adminExpiredBtn')}</button>
          <button class="btn btn--ghost btn--sm" data-action="admin:week:recap">📊 ${t('adminRecapBtn')}</button>
        </div>
      </div>
    </div>
  `;
}

function _kpi(icon, val, label) {
  return `<div class="admin-kpi">
    <div class="admin-kpi__icon">${icon}</div>
    <div class="admin-kpi__val">${val}</div>
    <div class="admin-kpi__label">${label}</div>
  </div>`;
}

// ── Template Generator ─────────────────────────────────────
function _renderTemplates() {
  const lang      = state.lang || 'de';
  const defaults  = TEMPLATES[lang] || TEMPLATES.de;
  const custom    = state.db.settings?.tplLibrary || {};
  const curIdx    = state.db.settings?.tplIdx ?? 0;

  const rows = defaults.map((def, i) => {
    const text       = custom[i] ?? def;
    const isCustom   = custom[i] !== undefined && custom[i] !== def;
    const isCurrent  = i === (curIdx % defaults.length);
    return `
      <div class="tpl-row ${isCurrent ? 'tpl-row--active' : ''}">
        <div class="tpl-row__body">
          <div class="tpl-row__meta">
            <span class="tpl-row__idx">${i + 1}</span>
            ${isCurrent  ? `<span class="tpl-tag tpl-tag--cur">🔄 ${t('tplCurrent')}</span>` : ''}
            ${isCustom   ? `<span class="tpl-tag tpl-tag--custom">✏️ ${t('tplCustomized')}</span>` : ''}
          </div>
          <div class="tpl-row__text">${esc(text)}</div>
        </div>
        <button class="btn btn--ghost btn--sm tpl-edit-btn"
          data-action="tpl:edit" data-idx="${i}">${t('tplEdit')}</button>
      </div>
    `;
  }).join('');

  return `
    <div class="admin-tpl-wrap">
      <div class="admin-section__title" style="padding:0 0 var(--sp-2)">
        💬 ${t('tplGeneratorTitle')}
        <span class="admin-kpi-sub">${t('tplGeneratorSub')}</span>
      </div>
      <div class="tpl-list">${rows}</div>
    </div>
  `;
}

// ── Members ────────────────────────────────────────────────
function _renderMembers() {
  const all = Object.entries(state.db.members || {})
    .sort(([, a], [, b]) => {
      const aInactive = a.status === 'inactive';
      const bInactive = b.status === 'inactive';
      if (aInactive !== bInactive) return aInactive ? 1 : -1;
      return (b.stats?.given || 0) - (a.stats?.given || 0);
    });

  const filtered = _memberSearch
    ? all.filter(([k, m]) => (m.name || k).toLowerCase().includes(_memberSearch.toLowerCase()))
    : all;

  const groups  = state.db.groups || {};
  const grouped = {};
  const ungrouped = [];

  filtered.forEach(([key, m]) => {
    let found = false;
    Object.values(groups).forEach(g => {
      if ((g.members || []).includes(key)) {
        grouped[g.id] = grouped[g.id] || [];
        grouped[g.id].push([key, m]);
        found = true;
      }
    });
    if (!found) ungrouped.push([key, m]);
  });

  return `
    <div class="admin-search-bar">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input class="admin-search-input" id="admin-member-search"
        placeholder="${t('adminSearchPH')}" value="${esc(_memberSearch)}"
        data-action="admin:member:search">
    </div>
    <div class="admin-member-list">
      ${Object.values(groups).sort((a, b) => (a.number||0) - (b.number||0)).map(g => {
        const gm = grouped[g.id] || [];
        if (!gm.length) return '';
        return `<div class="admin-group" data-gid="${esc(g.id)}">
          <div class="admin-group__header" data-action="admin:group:toggle" data-group="${esc(g.id)}">
            <span class="admin-group__name">${esc(g.name)}</span>
            <span class="badge badge--primary">${gm.length}</span>
            <svg class="admin-group__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div class="admin-group__body">
            ${gm.map(([k, m]) => _adminMemberRow(k, m)).join('')}
          </div>
        </div>`;
      }).join('')}
      ${ungrouped.length ? `
        <div class="admin-group" data-gid="__ungrouped">
          <div class="admin-group__header" data-action="admin:group:toggle" data-group="__ungrouped">
            <span class="admin-group__name">${t('adminNoGroup')}</span>
            <span class="badge">${ungrouped.length}</span>
            ${Object.keys(groups).length ? `<button class="btn btn--ghost btn--sm" style="margin-left:auto;margin-right:8px;font-size:11px"
              data-action="admin:distribute-members">🔀 Verteilen</button>` : ''}
            <svg class="admin-group__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div class="admin-group__body">
            ${ungrouped.map(([k, m]) => _adminMemberRow(k, m)).join('')}
          </div>
        </div>` : ''}
      ${!filtered.length ? `<div class="admin-empty">${t('adminNoResult')} "${esc(_memberSearch)}"</div>` : ''}
    </div>
  `;
}

function _adminMemberRow(key, m) {
  const bal      = (m.stats?.given || 0) - (m.stats?.received || 0);
  const grad     = avatarGradient(key);
  const initials = key.slice(0, 2).toUpperCase();
  const balCls   = bal > 0 ? 'pos' : bal < 0 ? 'neg' : '';
  const online   = m.online === true;
  const inactive = m.status === 'inactive';

  return `<div class="admin-member-row${inactive ? ' admin-member-row--inactive' : ''}">
    <div class="admin-member-row__av-wrap">
      <div class="admin-member-row__av" style="background:${grad};opacity:${inactive?'0.45':'1'}">${initials}</div>
      ${online && !inactive ? '<span class="admin-member-row__online"></span>' : ''}
    </div>
    <div class="admin-member-row__body">
      <div class="admin-member-row__name">
        ${esc(m.name || key)}${m.role==='admin'?' 👑':''}
        ${inactive ? '<span class="badge badge--warning" style="margin-left:4px;font-size:10px">inaktiv</span>' : ''}
      </div>
      <div class="admin-member-row__meta">G:${m.stats?.given||0} · R:${m.stats?.received||0} · W:${m.weeklyGiven||0}</div>
    </div>
    <div class="admin-member-row__bal admin-member-row__bal--${balCls}">${bal > 0 ? '+' : ''}${bal}</div>
    <div class="admin-member-row__actions">
      ${inactive ? `
        <button class="btn btn--ghost btn--icon btn--sm"
          data-action="admin:member:reactivate" data-key="${esc(key)}" title="Reaktivieren" aria-label="Reaktivieren">
          ✓
        </button>
      ` : `
        <button class="btn btn--ghost btn--icon btn--sm"
          data-action="admin:member:assign-group" data-key="${esc(key)}" title="Gruppe zuweisen" aria-label="Gruppe">
          📁
        </button>
        <button class="btn btn--ghost btn--icon btn--sm"
          data-action="admin:member:balance" data-key="${esc(key)}" title="Balance anpassen" aria-label="Balance">
          ⚖️
        </button>
        <button class="btn btn--ghost btn--icon btn--sm"
          data-action="admin:member:view-as" data-key="${esc(key)}" title="Als Mitglied anzeigen" aria-label="Ansehen">
          👁
        </button>
        <button class="btn btn--ghost btn--icon btn--sm"
          data-action="admin:member:kick" data-key="${esc(key)}" title="Entfernen" aria-label="Entfernen">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      `}
    </div>
  </div>`;
}

// ── Videos ─────────────────────────────────────────────────
function _renderVideos() {
  const R1_NEED = 10;
  const videos = Object.entries(state.db.videos || {})
    .sort(([,a],[,b]) => (b.postedAt||b.ts||0) - (a.postedAt||a.ts||0))
    .slice(0, 40);

  if (!videos.length) return `<div class="admin-empty">${t('adminNoVideos')}</div>`;

  return `<div class="admin-video-list">
    ${videos.map(([id, v]) => {
      const owner   = v.ownerKey || v.owner || '?';
      const link    = v.link || v.url || '';
      const r1      = (v.r1Supporters || []).length;
      const r1n     = v.r1Need || R1_NEED;
      const pct     = Math.min(100, Math.round((r1/r1n)*100));
      const status  = v.status || 'open';
      const round   = v.round || 1;
      const grad    = avatarGradient(owner);

      return `<div class="admin-vid-row">
        <div class="admin-vid-row__av" style="background:${grad}">${owner.slice(0,2).toUpperCase()}</div>
        <div class="admin-vid-row__body">
          <div class="admin-vid-row__owner">@${esc(owner)} <span class="round-pill round-pill--r${round}">R${round}</span></div>
          <div class="admin-vid-row__link">${esc(link.replace(/^https?:\/\/(www\.)?/,'').slice(0,36))}</div>
          <div class="admin-vid-prog">
            <div class="admin-vid-prog__bar"><div style="width:${pct}%"></div></div>
            <span>${r1}/${r1n}</span>
          </div>
        </div>
        <div class="admin-vid-row__actions">
          <span class="badge ${status==='done'?'badge--success':status==='expired'?'badge--warning':'badge--primary'}">${status}</span>
          <button class="btn btn--ghost btn--icon btn--sm" data-action="admin:vid:done" data-vid-id="${esc(id)}" title="Als Done markieren" aria-label="Done">✓</button>
          <button class="btn btn--danger btn--icon btn--sm" data-action="admin:vid:delete" data-vid-id="${esc(id)}" title="Löschen" aria-label="Löschen">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
          </button>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

// ── Broadcast ──────────────────────────────────────────────
function _renderBroadcast() {
  const cur    = state.db.settings?.broadcast || '';
  const active = state.db.settings?.broadcastActive || false;

  return `
    <div class="admin-broadcast">
      <div class="admin-section__title">📢 ${t('adminBcTitle')}</div>
      <textarea id="broadcast-text" class="admin-textarea" rows="4"
        placeholder="${t('adminBcPH')}">${esc(cur)}</textarea>
      <div class="admin-bc-controls">
        <button class="btn btn--primary btn--sm" data-action="admin:bc:save">💾 ${t('adminBcSave')}</button>
        <button class="btn btn--sm ${active?'btn--danger':'btn--secondary'}" data-action="admin:bc:toggle">
          ${active ? `⏹ ${t('adminBcDisable')}` : `▶ ${t('adminBcEnable')}`}
        </button>
      </div>
      <div class="admin-bc-status ${active?'admin-bc-status--on':''}">
        ${active ? `🟢 ${t('adminBcActiveMsg')}` : `⚪ ${t('adminBcInactiveMsg')}`}
      </div>
    </div>
  `;
}

// ── Messages (Weekly) ──────────────────────────────────────
function _renderMessages() {
  const templates  = t('weeklyTpl') || [];
  const mode       = state.db.settings?.weeklyMsgMode || 'auto';
  const lastSent   = state.db.settings?.weeklyMsgLastSent || 0;
  const members    = Object.values(state.db.members || {});
  const activeCount = members.filter(m => m.status === 'active' && m.role !== 'admin').length;

  const tplArr = Array.isArray(templates) ? templates : [];
  const previewIdx  = state._msgPreviewIdx != null
    ? state._msgPreviewIdx % (tplArr.length || 1)
    : 0;
  const previewText = tplArr[previewIdx] || '';

  const lastSentStr = lastSent
    ? new Date(lastSent).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
    : '—';

  return `
    <div class="admin-messages-tab">
      <div class="am-hero">
        <div class="am-hero__icon">📨</div>
        <div class="am-hero__body">
          <div class="am-hero__title">${t('weeklyMsgTitle') || 'Wöchentliche Nachricht'}</div>
          <div class="am-hero__sub">${t('weeklyMsgSub') || 'Nachricht an alle aktiven Mitglieder senden'}</div>
        </div>
      </div>

      <div class="am-mode-tabs">
        <button class="am-mode-btn${mode === 'auto' ? ' active' : ''}" data-action="admin:msg:mode" data-mode="auto">
          🤖 ${t('weeklyMsgAuto') || 'Vorgefertigt'}
        </button>
        <button class="am-mode-btn${mode === 'manual' ? ' active' : ''}" data-action="admin:msg:mode" data-mode="manual">
          ✍️ ${t('weeklyMsgManual') || 'Manuell'}
        </button>
      </div>

      ${mode === 'auto' ? `
        <div class="am-label">${t('weeklyMsgPreview') || 'Vorschau'}</div>
        <div class="am-preview">${esc(previewText)}</div>
        ${tplArr.length > 1 ? `
          <button class="am-btn-secondary" data-action="admin:msg:pickrandom">
            🔀 ${t('weeklyMsgPickRandom') || 'Andere Vorlage'}
          </button>` : ''}
        <button class="am-send-btn" data-action="admin:msg:send" data-tpl="${esc(previewText)}">
          📤 ${t('weeklyMsgSend') || 'An alle senden'}
        </button>
      ` : `
        <div class="am-label">${t('weeklyMsgCustomLabel') || 'Eigene Nachricht'}</div>
        <textarea id="admin-msg-custom" class="am-textarea" rows="5"
          placeholder="${t('weeklyMsgCustomLabel') || 'Nachricht eingeben...'}"></textarea>
        <div class="am-hint">⚠️ ${t('weeklyMsgCustomHint') || 'Manuelle Nachrichten werden nicht übersetzt'}</div>
        <button class="am-send-btn" data-action="admin:msg:send:custom">
          📤 ${t('weeklyMsgSend') || 'An alle senden'}
        </button>
      `}

      <div class="am-stats">
        <div class="am-stat">
          <div class="am-stat-num">${activeCount}</div>
          <div class="am-stat-lbl">${t('weeklyMsgActiveMembers') || 'Aktive Mitglieder'}</div>
        </div>
        <div class="am-stat">
          <div class="am-stat-num">${lastSentStr}</div>
          <div class="am-stat-lbl">${t('weeklyMsgLastSent') || 'Letzte Sendung'}</div>
        </div>
      </div>
    </div>
  `;
}

// ── Groups ─────────────────────────────────────────────────
function _renderGroups() {
  const groups = Object.values(state.db.groups || {})
    .sort((a, b) => (a.number||0) - (b.number||0));

  if (!groups.length) return `<div class="admin-empty">${t('adminNoGroups')}</div>`;

  return `<div class="admin-groups-list">
    ${groups.map(g => {
      const memberCount = (g.members || []).length;
      return `<div class="admin-group-card">
        <div class="admin-group-card__head">
          <div class="admin-group-card__name">${esc(g.name)}</div>
          <span class="badge badge--primary">${memberCount} ${t('adminTabMembers')}</span>
        </div>
        <div class="admin-group-card__meta">
          ${g.id ? `<span class="admin-group-card__id">ID: ${esc(g.id)}</span>` : ''}
          ${g.number != null ? `<span>Nr. ${g.number}</span>` : ''}
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

// ── Send weekly message to all active members ──────────────
function _sendWeeklyMessage(text) {
  const members = Object.keys(state.db.members || {}).filter(k => {
    const m = state.db.members[k];
    return m.status === 'active' && m.role !== 'admin';
  });
  import('../features/notifications.js').then(({ addNotif }) => {
    members.forEach(k => addNotif(k, '📨', '', 'weeklyMsg', {
      msgKey: 'weeklyTpl',
      params: { text },
      message: text,
    }));
  });
  writeDB('settings/weeklyMsgLastSent', Date.now());
  toast(`📨 ${t('weeklyMsgSend') || 'An alle senden'} (${members.length})`, 'success', 3000);
}

// ── Handlers ───────────────────────────────────────────────
function _registerHandlers() {
  on('admin:tab', (el) => {
    _tab = el.dataset.tab || 'overview';
    render();
  });

  on('admin:group:toggle', (el) => {
    const groupId = el.dataset.group;
    const body    = document.querySelector(`.admin-group[data-gid="${CSS.escape(groupId)}"] .admin-group__body`);
    if (body) body.classList.toggle('hidden');
    const chevron = el.querySelector('.admin-group__chevron');
    if (chevron) chevron.style.transform = body?.classList.contains('hidden') ? '' : 'rotate(180deg)';
  });

  on('admin:member:search', (el) => {
    _memberSearch = el.value || '';
    _debounceRender();
  });

  on('admin:member:reactivate', async (el) => {
    const key = el.dataset.key;
    if (!key) return;
    writeDB(`members/${key}/status`, 'active');
    toast(`@${key} reaktiviert`, 'success');
    setTimeout(render, 300);
  });

  on('admin:member:assign-group', (el) => {
    const key    = el.dataset.key;
    if (!key) return;
    const groups = Object.values(state.db.groups || {})
      .sort((a, b) => (a.number||0) - (b.number||0));
    const modalId = 'assign-group-modal';

    const currentGid = Object.entries(state.db.groups || {})
      .find(([, g]) => (g.members || []).includes(key))?.[0] || null;

    openModal({
      id: modalId,
      title: `@${key} – Gruppe zuweisen`,
      body: `<div style="display:flex;flex-direction:column;gap:8px;max-height:280px;overflow-y:auto;padding:2px">
        ${groups.map(g => `
          <button class="btn btn--ghost btn--full" style="justify-content:space-between${g.id===currentGid?';border-color:var(--accent)':''}"
            data-action="admin:member:set-group" data-key="${esc(key)}" data-gid="${esc(g.id)}" data-modal="${modalId}">
            ${esc(g.name)} ${g.id===currentGid?'✓':''}
            <span class="badge badge--primary">${(g.members||[]).length}</span>
          </button>`).join('')}
        ${currentGid ? `<button class="btn btn--ghost btn--full" style="color:var(--fg-3);margin-top:4px"
          data-action="admin:member:set-group" data-key="${esc(key)}" data-gid="" data-modal="${modalId}">
          Keine Gruppe
        </button>` : ''}
      </div>`,
      actions: []
    });
  });

  on('admin:member:set-group', (el) => {
    const key     = el.dataset.key;
    const newGid  = el.dataset.gid;
    const modalId = el.dataset.modal;
    if (!key) return;

    Object.entries(state.db.groups || {}).forEach(([gid, g]) => {
      const arr = g.members || [];
      if (arr.includes(key)) writeDB(`groups/${gid}/members`, arr.filter(m => m !== key));
    });

    if (newGid) {
      const arr = state.db.groups?.[newGid]?.members || [];
      if (!arr.includes(key)) writeDB(`groups/${newGid}/members`, [...arr, key]);
    }

    closeModal(modalId);
    toast(`@${key} ${newGid ? 'zugewiesen' : 'aus Gruppe entfernt'}`, 'success');
    setTimeout(render, 400);
  });

  on('admin:distribute-members', async () => {
    const groups = Object.values(state.db.groups || {})
      .sort((a, b) => (a.number||0) - (b.number||0));
    if (!groups.length) return;

    const groupedKeys = new Set(groups.flatMap(g => g.members || []));
    const unassigned  = Object.entries(state.db.members || {})
      .filter(([k, m]) => m.status !== 'inactive' && m.role !== 'admin' && !groupedKeys.has(k))
      .map(([k]) => k);

    if (!unassigned.length) { toast('Alle Mitglieder sind bereits in Gruppen', 'info'); return; }

    const ok = await confirm(
      `${unassigned.length} Mitglieder gleichmäßig verteilen?`,
      `Auf ${groups.length} Gruppen aufteilen`
    );
    if (!ok) return;

    const updated = {};
    groups.forEach(g => { updated[g.id] = [...(g.members || [])]; });
    unassigned.forEach((k, i) => updated[groups[i % groups.length].id].push(k));
    Object.entries(updated).forEach(([gid, arr]) => writeDB(`groups/${gid}/members`, arr));

    toast(`${unassigned.length} Mitglieder verteilt`, 'success');
    setTimeout(render, 500);
  });

  on('admin:member:kick', async (el) => {
    const key = el.dataset.key;
    if (!key) return;
    const ok = await confirm(`@${key} entfernen?`, t('adminKickSub'));
    if (!ok) return;
    writeDB(`members/${key}/status`, 'inactive');
    // Remove kicked member from all group arrays so counts stay accurate
    Object.entries(state.db.groups || {}).forEach(([gid, g]) => {
      const members = g.members || [];
      if (members.includes(key)) {
        writeDB(`groups/${gid}/members`, members.filter(m => m !== key));
      }
    });
    toast(`@${key} entfernt`, 'success');
    setTimeout(render, 300);
  });

  on('admin:vid:delete', async (el) => {
    const id = el.dataset.vidId;
    if (!id) return;
    const ok = await confirm(t('adminVidDelConfirm'), t('adminVidDelSub'));
    if (!ok) return;
    writeDB(`videos/${id}`, null);
    toast(t('adminVidDeleted'), 'success');
    setTimeout(render, 300);
  });

  on('admin:vid:done', (el) => {
    const id = el.dataset.vidId;
    if (!id) return;
    writeDB(`videos/${id}/status`, 'done');
    toast(t('adminVidDone'), 'success');
    setTimeout(render, 300);
  });

  on('admin:bc:save', () => {
    const ta = document.getElementById('broadcast-text');
    const text = ta?.value || '';
    _skipBcEcho = true;
    writeDB('settings/broadcast', text);
    toast(t('adminBcSaved'), 'success');
  });

  on('admin:bc:toggle', () => {
    const active = state.db.settings?.broadcastActive || false;
    const next   = !active;
    writeDB('settings/broadcastActive', next);
    toast(next ? t('adminBcActiveToast') : t('adminBcDeactiveToast'), 'success');
    // Update toggle button + status in-place — avoids nuking the textarea
    const btn = document.querySelector('[data-action="admin:bc:toggle"]');
    const status = document.querySelector('.admin-bc-status');
    if (btn) {
      btn.className = `btn btn--sm ${next ? 'btn--danger' : 'btn--secondary'}`;
      btn.textContent = next ? `⏹ ${t('adminBcDisable')}` : `▶ ${t('adminBcEnable')}`;
    }
    if (status) {
      status.className = `admin-bc-status ${next ? 'admin-bc-status--on' : ''}`;
      status.textContent = next
        ? `🟢 ${t('adminBcActiveMsg')}`
        : `⚪ ${t('adminBcInactiveMsg')}`;
    }
  });

  on('admin:week:recap', () => {
    const members = Object.entries(state.db.members || {})
      .filter(([, m]) => m.status === 'active' && m.role !== 'admin');
    const totalWeekly = members.reduce((s, [, m]) => s + (m.weeklyGiven || 0), 0);
    const top = [...members]
      .sort(([, a], [, b]) => (b.weeklyGiven || 0) - (a.weeklyGiven || 0))
      .slice(0, 5);
    const vids = Object.values(state.db.videos || {});
    const weekAgo = Date.now() - 7 * 86400000;
    const newVids = vids.filter(v => (v.postedAt || v.ts || 0) > weekAgo).length;
    const avgPerMember = members.length ? (totalWeekly / members.length).toFixed(1) : 0;

    const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
    const rows = top.map(([k, m], i) => `
      <div class="admin-recap-row">
        <span class="admin-recap-row__medal">${medals[i]}</span>
        <span class="admin-recap-row__name">@${esc(k)}</span>
        <span class="admin-recap-row__val">${m.weeklyGiven || 0} Supports</span>
      </div>`).join('');

    openModal({
      id: 'week-recap-modal',
      title: '📊 Wochenrückblick',
      body: `
        <div class="recap-stats">
          <div class="recap-stat"><div class="recap-stat__val">${totalWeekly}</div><div class="recap-stat__label">${t('adminRecapTotalSup')}</div></div>
          <div class="recap-stat"><div class="recap-stat__val">${newVids}</div><div class="recap-stat__label">${t('adminRecapNewVids')}</div></div>
          <div class="recap-stat"><div class="recap-stat__val">${avgPerMember}</div><div class="recap-stat__label">${t('adminRecapAvg')}</div></div>
          <div class="recap-stat"><div class="recap-stat__val">${members.length}</div><div class="recap-stat__label">${t('adminRecapActiveMembers')}</div></div>
        </div>
        <div class="admin-section__title" style="margin:16px 0 8px">🏆 ${t('adminRecapTopWeek')}</div>
        ${rows || `<div style="color:var(--text-tertiary);font-size:13px">${t('adminRecapNoActivity')}</div>`}
      `,
    });
  });

  on('tmpl:copy', (el) => {
    const text = el.dataset.text || '';
    navigator.clipboard?.writeText(text).then(() => toast(t('adminTmplCopied'), 'success'))
      .catch(() => toast(text, 'info'));
  });

  on('tpl:edit', (el) => {
    const idx      = parseInt(el.dataset.idx, 10);
    const lang     = state.lang || 'de';
    const defaults = TEMPLATES[lang] || TEMPLATES.de;
    const custom   = state.db.settings?.tplLibrary || {};
    const current  = custom[idx] ?? defaults[idx] ?? '';
    const PHKEYS   = ['{gruppe}','{name}','{member}','{date}','{time}'];
    const PHEX     = { '{gruppe}':'1', '{name}':'maxpower', '{member}':'boostsquad',
                       '{date}': new Date().toLocaleDateString('de'), '{time}': new Date().toLocaleTimeString('de',{hour:'2-digit',minute:'2-digit'}) };

    function makePreview(text) {
      let p = esc(text);
      PHKEYS.forEach(k => { p = p.replace(new RegExp(k.replace(/[{}]/g,'\\$&'),'g'), `<span class="tpl-ph">${PHEX[k]}</span>`); });
      return p.replace(/\n/g,'<br>');
    }

    openModal({
      id: 'tpl-editor-modal',
      title: `✏️ ${t('tplEdit')} #${idx+1}`,
      body: `
        <textarea id="tpl-ta" class="tpl-textarea" rows="6">${esc(current)}</textarea>
        <div class="tpl-ph-bar">
          ${PHKEYS.map(k => `<button class="tpl-ph-pill" data-action="tpl:ins" data-ph="${k}">${k}</button>`).join('')}
        </div>
        <div class="tpl-preview-label">${t('tplPreview')}</div>
        <div class="tpl-preview-box" id="tpl-preview">${makePreview(current)}</div>
        <div class="tpl-modal-actions">
          <button class="btn btn--ghost btn--sm" data-action="tpl:reset-one" data-idx="${idx}">↩️ ${t('tplReset')}</button>
          <button class="btn btn--primary" data-action="tpl:save" data-idx="${idx}">${t('tplSave')}</button>
        </div>
      `,
    });

    // Live preview update
    requestAnimationFrame(() => {
      const ta = document.getElementById('tpl-ta');
      if (ta) ta.addEventListener('input', () => {
        const pv = document.getElementById('tpl-preview');
        if (pv) pv.innerHTML = makePreview(ta.value);
      });
    });
  });

  on('tpl:ins', (el) => {
    const ta = document.getElementById('tpl-ta');
    const ph = el.dataset.ph || '';
    if (!ta || !ph) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    ta.value = ta.value.slice(0, s) + ph + ta.value.slice(e);
    ta.selectionStart = ta.selectionEnd = s + ph.length;
    ta.focus();
    const pv = document.getElementById('tpl-preview');
    if (pv) {
      const PHKEYS = ['{gruppe}','{name}','{member}','{date}','{time}'];
      const PHEX = { '{gruppe}':'1', '{name}':'maxpower', '{member}':'boostsquad',
        '{date}': new Date().toLocaleDateString('de'), '{time}': new Date().toLocaleTimeString('de',{hour:'2-digit',minute:'2-digit'}) };
      let p = ta.value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      PHKEYS.forEach(k => { p = p.replace(new RegExp(k.replace(/[{}]/g,'\\$&'),'g'), `<span class="tpl-ph">${PHEX[k]}</span>`); });
      pv.innerHTML = p.replace(/\n/g,'<br>');
    }
  });

  on('tpl:save', (el) => {
    const idx = parseInt(el.dataset.idx, 10);
    const ta  = document.getElementById('tpl-ta');
    if (!ta) return;
    const text = ta.value;
    writeDB(`settings/tplLibrary/${idx}`, text);
    closeModal();
    toast(`✅ ${t('tplSaved')}`, 'success');
    setTimeout(render, 200);
  });

  on('tpl:reset-one', async (el) => {
    const idx = parseInt(el.dataset.idx, 10);
    const ok  = await confirm(t('tplReset') + '?', '');
    if (!ok) return;
    writeDB(`settings/tplLibrary/${idx}`, null);
    closeModal();
    toast(`↩️ ${t('tplResetDone')}`, 'success');
    setTimeout(render, 200);
  });

  on('admin:week:reset', async () => {
    const ok = await confirm(t('adminWeekResetConfirm'), 'weeklyGiven aller Mitglieder wird auf 0 gesetzt.');
    if (!ok) return;
    const members = state.db.members || {};
    const updates = {};
    Object.keys(members).forEach(k => { updates[`members/${k}/weeklyGiven`] = 0; });
    Object.entries(updates).forEach(([p, v]) => writeDB(p, v));
    toast(t('adminWeekResetDone'), 'success');
  });

  on('admin:vid:cleanup', async () => {
    const ok = await confirm(t('adminExpiredConfirm'), 'Alle Videos mit Status "expired" werden gelöscht.');
    if (!ok) return;
    const vids = state.db.videos || {};
    Object.entries(vids).forEach(([id, v]) => {
      if (v.status === 'expired') writeDB(`videos/${id}`, null);
    });
    toast(t('adminExpiredDone'), 'success');
    setTimeout(render, 300);
  });

  on('admin:member:balance', (el) => {
    const key = el.dataset.key;
    if (!key) return;
    _balAdjKey = key;
    const m     = state.db.members?.[key] || {};
    const given = m.stats?.given    || 0;
    const recv  = m.stats?.received || 0;
    const balCls = (given - recv) >= 0 ? 'pos' : 'neg';
    openModal({
      id:    'bal-adj-modal',
      title: `⚖️ Balance: @${esc(key)}`,
      body: `
        <div class="bal-adj">
          <div class="bal-adj__stats">
            <span>Gegeben: <strong>${given}</strong></span>
            <span>Erhalten: <strong>${recv}</strong></span>
            <span>Saldo: <strong class="${balCls}">${(given-recv)>=0?'+':''}${given-recv}</strong></span>
          </div>
          <div class="bal-adj__row">
            <label class="bal-adj__label">${t('adminBalGivenLbl')}</label>
            <input type="number" id="bal-given" value="${given}" min="0" class="bal-adj__input">
          </div>
          <div class="bal-adj__row">
            <label class="bal-adj__label">${t('adminBalRecvLbl')}</label>
            <input type="number" id="bal-recv" value="${recv}" min="0" class="bal-adj__input">
          </div>
        </div>`,
      actions: [
        { label: '💾 Speichern',    cmd: 'save',    class: 'btn--primary' },
        { label: '🔄 Reset (0/0)',  cmd: 'autofix', class: 'btn--secondary' },
      ],
    });
    on('modal:action', (btn) => {
      if (btn.dataset.modal !== 'bal-adj-modal') return;
      if (btn.dataset.cmd === 'save') {
        const g = parseInt(document.getElementById('bal-given')?.value  || '0', 10);
        const r = parseInt(document.getElementById('bal-recv')?.value   || '0', 10);
        writeDB(`members/${_balAdjKey}/stats/given`,    g);
        writeDB(`members/${_balAdjKey}/stats/received`, r);
        closeModal('bal-adj-modal');
        toast(`Balance für @${_balAdjKey} angepasst ✓`, 'success');
        setTimeout(render, 300);
      } else if (btn.dataset.cmd === 'autofix') {
        writeDB(`members/${_balAdjKey}/stats/given`,    0);
        writeDB(`members/${_balAdjKey}/stats/received`, 0);
        closeModal('bal-adj-modal');
        toast(`Balance für @${_balAdjKey} zurückgesetzt ✓`, 'success');
        setTimeout(render, 300);
      }
    });
  });

  on('admin:member:view-as', (el) => {
    const key = el.dataset.key;
    if (!key || key === state.currentUser) return;
    _adminViewAs      = state.currentUser;
    state.currentUser = key;
    _syncViewBar();
    toast(`👁 Ansicht als @${key}`, 'info');
    import('../router.js').then(m => m.goScreen('home'));
  });

  on('admin:view-back', () => {
    if (!_adminViewAs) return;
    state.currentUser = _adminViewAs;
    _adminViewAs      = null;
    const bar = document.getElementById('admin-view-bar');
    if (bar) bar.remove();
    toast(t('adminViewBackToast'), 'success');
    import('../router.js').then(m => m.goScreen('admin'));
  });

  on('admin:msg:mode', (el) => {
    const mode = el.dataset.mode || 'auto';
    writeDB('settings/weeklyMsgMode', mode);
    setTimeout(render, 150);
  });

  on('admin:msg:pickrandom', () => {
    const templates = t('weeklyTpl') || [];
    const tplArr = Array.isArray(templates) ? templates : [];
    if (tplArr.length < 2) return;
    const current = state._msgPreviewIdx != null ? state._msgPreviewIdx % tplArr.length : 0;
    let next = Math.floor(Math.random() * (tplArr.length - 1));
    if (next >= current) next++;
    state._msgPreviewIdx = next;
    render();
  });

  on('admin:msg:send', async (el) => {
    const text = el.dataset.tpl;
    if (!text) return;
    const ok = await confirm(t('weeklyMsgSend') || 'An alle senden?', text.slice(0, 60));
    if (!ok) return;
    _sendWeeklyMessage(text);
  });

  on('admin:msg:send:custom', async () => {
    const ta   = document.getElementById('admin-msg-custom');
    const text = ta?.value?.trim();
    if (!text) return;
    const ok = await confirm(t('weeklyMsgSend') || 'An alle senden?', text.slice(0, 60));
    if (!ok) return;
    _sendWeeklyMessage(text);
  });
}

let _renderTimer = null;
function _debounceRender() {
  clearTimeout(_renderTimer);
  _renderTimer = setTimeout(render, 200);
}

// ── Impersonation bar ──────────────────────────────────────
function _syncViewBar() {
  const existing = document.getElementById('admin-view-bar');
  if (!_adminViewAs) { if (existing) existing.remove(); return; }
  if (existing) return; // already present
  const bar = document.createElement('div');
  bar.id        = 'admin-view-bar';
  bar.className = 'admin-view-bar';
  bar.innerHTML = `<span>${t('adminViewBarLabel')} <strong>@${esc(state.currentUser)}</strong></span>
    <button class="btn btn--sm btn--danger admin-view-bar__btn" data-action="admin:view-back">${t('adminViewBackBtn')}</button>`;
  document.body.appendChild(bar);
}
