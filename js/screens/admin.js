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
import { getTemplates } from '../features/adminTemplates.js';
import { progressRing } from '../components/progress.js';
import { renderFairnessMeter } from '../features/fairnessMeter.js';

const TABS = ['overview', 'members', 'videos', 'broadcast', 'groups'];
let _tab          = 'overview';
let _memberSearch = '';
let _skipBcEcho   = false;
let _balAdjKey    = null;  // key of member being balance-adjusted
let _adminViewAs  = null;  // original admin key during impersonation

// ── Admin auth guard ───────────────────────────────────────
function _isAdmin(cu) {
  if (!cu) return false;
  const u = state.db.members?.[cu];
  if (!u || u.role !== 'admin' || u.status !== 'active') return false;
  const admins = state.db.settings?.admins;
  // If settings.admins list exists, cu must be in it
  if (Array.isArray(admins) && !admins.includes(cu)) return false;
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
        <div class="admin-denied__title">Kein Zugriff</div>
        <div class="admin-denied__sub">Nur Admins können diesen Bereich sehen</div>
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
      ${_tab === 'overview'  ? _renderOverview()  : ''}
      ${_tab === 'members'   ? _renderMembers()   : ''}
      ${_tab === 'videos'    ? _renderVideos()    : ''}
      ${_tab === 'broadcast' ? _renderBroadcast() : ''}
      ${_tab === 'groups'    ? _renderGroups()    : ''}
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
  return { overview:'Übersicht', members:'Mitglieder', videos:'Videos',
           broadcast:'Broadcast', groups:'Gruppen' }[tab] || tab;
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
        ${_kpi('👥', active, 'Mitglieder')}
        ${_kpi('🟢', online, 'Online')}
        ${_kpi('🎯', openVids, 'Offen')}
        ${_kpi('📊', weeklyTotal, 'Woche ges.')}
        ${_kpi('🏠', groups, 'Gruppen')}
        ${_kpi('💬', totalMsg, 'Nachrichten')}
      </div>

      <div class="admin-rings-row">
        ${progressRing(online, Math.max(active, 1), { label: 'Online', size: 64, color: 'var(--success, #10b981)' })}
        ${progressRing(doneVids, Math.max(allVids.length, 1), { label: 'Videos', size: 64, color: 'var(--accent-primary)' })}
        ${progressRing(weeklyTotal, Math.max(weeklyTotal, active * 5, 1), { label: 'Woche', size: 64, color: 'var(--accent-warning, #f59e0b)' })}
      </div>

      ${topThisWeek.length ? `
      <div class="admin-section">
        <div class="admin-section__title">🏆 Top diese Woche</div>
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
        <div class="admin-section__title">💬 Kommentar-Vorlagen</div>
        <div class="tmpl-grid">
          ${getTemplates(state.lang || 'de').slice(0, 6).map((text, i) => `
            <button class="tmpl-chip" data-action="tmpl:copy" data-text="${esc(text)}">${esc(text)}</button>
          `).join('')}
        </div>
      </div>

      <div class="admin-section">
        <div class="admin-section__title">⚡ Schnellaktionen</div>
        <div class="admin-actions-row">
          <button class="btn btn--ghost btn--sm" data-action="admin:week:reset">🔄 Woche reset</button>
          <button class="btn btn--ghost btn--sm" data-action="admin:vid:cleanup">🧹 Expired bereinigen</button>
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

// ── Members ────────────────────────────────────────────────
function _renderMembers() {
  const all = Object.entries(state.db.members || {})
    .filter(([, m]) => m.status === 'active')
    .sort(([, a], [, b]) => (b.stats?.given || 0) - (a.stats?.given || 0));

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
        placeholder="Mitglied suchen…" value="${esc(_memberSearch)}"
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
            <span class="admin-group__name">Ohne Gruppe</span>
            <span class="badge">${ungrouped.length}</span>
            <svg class="admin-group__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div class="admin-group__body">
            ${ungrouped.map(([k, m]) => _adminMemberRow(k, m)).join('')}
          </div>
        </div>` : ''}
      ${!filtered.length ? `<div class="admin-empty">Keine Ergebnisse für "${esc(_memberSearch)}"</div>` : ''}
    </div>
  `;
}

function _adminMemberRow(key, m) {
  const bal   = (m.stats?.given || 0) - (m.stats?.received || 0);
  const grad  = avatarGradient(key);
  const initials = key.slice(0, 2).toUpperCase();
  const balCls   = bal > 0 ? 'pos' : bal < 0 ? 'neg' : '';
  const online   = m.online === true;

  return `<div class="admin-member-row">
    <div class="admin-member-row__av-wrap">
      <div class="admin-member-row__av" style="background:${grad}">${initials}</div>
      ${online ? '<span class="admin-member-row__online"></span>' : ''}
    </div>
    <div class="admin-member-row__body">
      <div class="admin-member-row__name">${esc(m.name || key)}${m.role==='admin'?' 👑':''}</div>
      <div class="admin-member-row__meta">G:${m.stats?.given||0} · R:${m.stats?.received||0} · W:${m.weeklyGiven||0}</div>
    </div>
    <div class="admin-member-row__bal admin-member-row__bal--${balCls}">${bal > 0 ? '+' : ''}${bal}</div>
    <div class="admin-member-row__actions">
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
    </div>
  </div>`;
}

// ── Videos ─────────────────────────────────────────────────
function _renderVideos() {
  const R1_NEED = 10;
  const videos = Object.entries(state.db.videos || {})
    .sort(([,a],[,b]) => (b.postedAt||b.ts||0) - (a.postedAt||a.ts||0))
    .slice(0, 40);

  if (!videos.length) return `<div class="admin-empty">Keine Videos</div>`;

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
      <div class="admin-section__title">📢 Broadcast-Nachricht</div>
      <textarea id="broadcast-text" class="admin-textarea" rows="4"
        placeholder="Nachricht an alle Mitglieder…">${esc(cur)}</textarea>
      <div class="admin-bc-controls">
        <button class="btn btn--primary btn--sm" data-action="admin:bc:save">💾 Speichern</button>
        <button class="btn btn--sm ${active?'btn--danger':'btn--secondary'}" data-action="admin:bc:toggle">
          ${active ? '⏹ Deaktivieren' : '▶ Aktivieren'}
        </button>
      </div>
      <div class="admin-bc-status ${active?'admin-bc-status--on':''}">
        ${active ? '🟢 Broadcast ist aktiv und wird allen angezeigt' : '⚪ Broadcast ist deaktiviert'}
      </div>
    </div>
  `;
}

// ── Groups ─────────────────────────────────────────────────
function _renderGroups() {
  const groups = Object.values(state.db.groups || {})
    .sort((a, b) => (a.number||0) - (b.number||0));

  if (!groups.length) return `<div class="admin-empty">Keine Gruppen konfiguriert</div>`;

  return `<div class="admin-groups-list">
    ${groups.map(g => {
      const memberCount = (g.members || []).length;
      return `<div class="admin-group-card">
        <div class="admin-group-card__head">
          <div class="admin-group-card__name">${esc(g.name)}</div>
          <span class="badge badge--primary">${memberCount} Mitglieder</span>
        </div>
        <div class="admin-group-card__meta">
          ${g.id ? `<span class="admin-group-card__id">ID: ${esc(g.id)}</span>` : ''}
          ${g.number != null ? `<span>Nr. ${g.number}</span>` : ''}
        </div>
      </div>`;
    }).join('')}
  </div>`;
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

  on('admin:member:kick', async (el) => {
    const key = el.dataset.key;
    if (!key) return;
    const ok = await confirm(`@${key} entfernen?`, 'Der Account wird auf inaktiv gesetzt.');
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
    const ok = await confirm('Video löschen?', 'Das Video wird endgültig entfernt.');
    if (!ok) return;
    writeDB(`videos/${id}`, null);
    toast('Video gelöscht', 'success');
    setTimeout(render, 300);
  });

  on('admin:vid:done', (el) => {
    const id = el.dataset.vidId;
    if (!id) return;
    writeDB(`videos/${id}/status`, 'done');
    toast('Video als Done markiert ✓', 'success');
    setTimeout(render, 300);
  });

  on('admin:bc:save', () => {
    const ta = document.getElementById('broadcast-text');
    const text = ta?.value || '';
    _skipBcEcho = true;
    writeDB('settings/broadcast', text);
    toast('Gespeichert ✓', 'success');
  });

  on('admin:bc:toggle', () => {
    const active = state.db.settings?.broadcastActive || false;
    const next   = !active;
    writeDB('settings/broadcastActive', next);
    toast(next ? 'Broadcast aktiv ✓' : 'Broadcast deaktiviert', 'success');
    // Update toggle button + status in-place — avoids nuking the textarea
    const btn = document.querySelector('[data-action="admin:bc:toggle"]');
    const status = document.querySelector('.admin-bc-status');
    if (btn) {
      btn.className = `btn btn--sm ${next ? 'btn--danger' : 'btn--secondary'}`;
      btn.textContent = next ? '⏹ Deaktivieren' : '▶ Aktivieren';
    }
    if (status) {
      status.className = `admin-bc-status ${next ? 'admin-bc-status--on' : ''}`;
      status.textContent = next
        ? '🟢 Broadcast ist aktiv und wird allen angezeigt'
        : '⚪ Broadcast ist deaktiviert';
    }
  });

  on('tmpl:copy', (el) => {
    const text = el.dataset.text || '';
    navigator.clipboard?.writeText(text).then(() => toast('Kopiert ✓', 'success'))
      .catch(() => toast(text, 'info'));
  });

  on('admin:week:reset', async () => {
    const ok = await confirm('Wochenzähler zurücksetzen?', 'weeklyGiven aller Mitglieder wird auf 0 gesetzt.');
    if (!ok) return;
    const members = state.db.members || {};
    const updates = {};
    Object.keys(members).forEach(k => { updates[`members/${k}/weeklyGiven`] = 0; });
    Object.entries(updates).forEach(([p, v]) => writeDB(p, v));
    toast('Woche zurückgesetzt ✓', 'success');
  });

  on('admin:vid:cleanup', async () => {
    const ok = await confirm('Expired Videos bereinigen?', 'Alle Videos mit Status "expired" werden gelöscht.');
    if (!ok) return;
    const vids = state.db.videos || {};
    Object.entries(vids).forEach(([id, v]) => {
      if (v.status === 'expired') writeDB(`videos/${id}`, null);
    });
    toast('Expired Videos bereinigt ✓', 'success');
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
            <label class="bal-adj__label">Gegeben setzen</label>
            <input type="number" id="bal-given" value="${given}" min="0" class="bal-adj__input">
          </div>
          <div class="bal-adj__row">
            <label class="bal-adj__label">Erhalten setzen</label>
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
    _adminViewAs     = state.currentUser;
    state.currentUser = key;
    _syncViewBar();
    toast(`👁 Ansicht als @${key}`, 'info');
    import('../main.js').then(m => m.navigateTo?.('home'));
  });

  on('admin:view-back', () => {
    if (!_adminViewAs) return;
    state.currentUser = _adminViewAs;
    _adminViewAs      = null;
    const bar = document.getElementById('admin-view-bar');
    if (bar) bar.remove();
    toast('Zurück im Admin-Modus', 'success');
    import('../main.js').then(m => m.navigateTo?.('admin'));
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
  bar.innerHTML = `<span>👁 Ansicht als <strong>@${esc(state.currentUser)}</strong></span>
    <button class="btn btn--sm btn--danger admin-view-bar__btn" data-action="admin:view-back">↩ Zurück zu Admin</button>`;
  document.body.appendChild(bar);
}
