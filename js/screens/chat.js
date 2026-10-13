/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Chat Screen  (Part D)
   Tabs: Pool-Chat | Direkt-Nachrichten
   ═══════════════════════════════════════════════════════ */

import { state }    from '../state.js';
import { t }        from '../i18n.js';
import { esc, timeAgo, avatarGradient } from '../utils.js';
import { on }       from '../events.js';
import { writeDB }  from '../firebase.js';
import { emptyState } from '../components/empty-state.js';

let _chatTab        = 'pool';  // 'pool' | 'dm'
let _dmPartner      = null;    // username of open DM thread
let _skipNextRender = false;   // set after in-place send to skip DB-echo re-render

export function render() {
  const el = document.getElementById('screen-chat');

  // After an in-place bubble append we wrote to DB; the DB listener fires
  // back almost immediately with the same data. Skip that one re-render so
  // the input bar / focus / keyboard stay intact.
  // Only skip when chat is the active screen — stale flags from a previous
  // visit must not leave the chat blank on re-entry.
  if (_skipNextRender && el?.classList.contains('active')) {
    _skipNextRender = false;
    return;
  }
  _skipNextRender = false;
  if (!el) return;

  const cu = state.currentUser;
  if (!cu) return;

  // Save scroll position and input value so a DB-triggered re-render
  // (e.g. another member posts) doesn't reset them unexpectedly.
  const prevInput     = document.getElementById('chat-pool-input')?.value ||
                        document.getElementById('chat-dm-input')?.value || '';
  const msgsBox       = document.getElementById('pool-messages');
  const atBottom      = !msgsBox || msgsBox.scrollTop + msgsBox.clientHeight >= msgsBox.scrollHeight - 40;

  if (_dmPartner) {
    _renderDMThread(el, cu, _dmPartner);
    return;
  }

  const poolMsgs  = _poolMessages();
  const dmThreads = _dmThreads(cu);
  const unreadDM  = dmThreads.reduce((s, t) => s + t.unread, 0);

  el.innerHTML = `
    <div class="chat-layout">
      <div class="chat-tabs">
        <button class="chat-tab ${_chatTab==='pool'?'chat-tab--active':''}"
          data-action="chat:tab" data-tab="pool">
          Pool
        </button>
        <button class="chat-tab ${_chatTab==='dm'?'chat-tab--active':''}"
          data-action="chat:tab" data-tab="dm">
          Direkt
          ${unreadDM > 0 ? `<span class="chat-tab__pip">${unreadDM}</span>` : ''}
        </button>
      </div>

      <div class="chat-content" id="chat-content-area">
        ${_chatTab === 'pool' ? _renderPool(cu, poolMsgs) : _renderDMList(cu, dmThreads)}
      </div>
    </div>
  `;

  _registerHandlers(cu);

  if (_chatTab === 'pool') {
    // Restore input text typed before the DB-triggered re-render
    const inp = document.getElementById('chat-pool-input');
    if (inp && prevInput) inp.value = prevInput;
    // Scroll to bottom only if we were already there
    if (atBottom) _scrollToBottom();
  }
}

// ── Pool Chat ──────────────────────────────────────────────
function _renderPool(cu, msgs) {
  return `
    <div class="pool-messages" id="pool-messages">
      ${msgs.length === 0
        ? emptyState('💬', 'Noch keine Nachrichten', 'Sei der Erste — schreib etwas!', { size: 'sm' })
        : msgs.map(m => _poolBubble(m, cu)).join('')
      }
    </div>
    <div class="chat-input-bar">
      <input
        class="chat-input" id="chat-pool-input"
        type="text" maxlength="400"
        placeholder="Nachricht an den Pool…"
        data-action="chat:pool:input"
        autocomplete="off"
      >
      <button class="chat-send-btn" data-action="chat:pool:send" aria-label="Senden">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </div>
  `;
}

function _poolBubble(m, cu) {
  const isMe   = m.from === cu;
  const u      = state.db.members?.[m.from] || {};
  const name   = u.name || m.from || '?';
  const grad   = avatarGradient(m.from || '');
  const initials = (m.from || '?').slice(0, 2).toUpperCase();

  return `
    <div class="bubble-row ${isMe ? 'bubble-row--me' : ''}">
      ${!isMe ? `<div class="bubble-avatar" style="background:${grad}" title="@${esc(m.from || '')}">${initials}</div>` : ''}
      <div class="bubble-col">
        ${!isMe ? `<div class="bubble-sender">@${esc(name)}</div>` : ''}
        <div class="bubble ${isMe ? 'bubble--me' : 'bubble--them'}">
          ${esc(m.text || '')}
        </div>
        <div class="bubble-time">${m.ts ? timeAgo(m.ts, state.lang) : ''}</div>
      </div>
    </div>
  `;
}

// ── DM List ────────────────────────────────────────────────
function _renderDMList(cu, threads) {
  const members = Object.entries(state.db.members || {})
    .filter(([key]) => key !== cu)
    .map(([key, m]) => {
      const thread = threads.find(t => t.partner === key);
      return { key, m, thread };
    })
    .sort((a, b) => {
      const at = a.thread?.lastTs || 0;
      const bt = b.thread?.lastTs || 0;
      return bt - at;
    });

  if (!members.length) {
    return emptyState('👥', 'Pool ist leer', 'Noch keine anderen Mitglieder');
  }

  return `
    <div class="dm-list">
      ${members.map(({ key, m, thread }) => {
        const grad    = avatarGradient(key);
        const initials= key.slice(0, 2).toUpperCase();
        const lastMsg  = thread?.lastText || '';
        const lastTs   = thread?.lastTs   || 0;
        const unread   = thread?.unread   || 0;
        const online   = m.online === true;

        return `<button class="dm-row" data-action="chat:dm:open" data-partner="${esc(key)}">
          <div class="dm-row__avatar-wrap">
            <div class="dm-row__avatar" style="background:${grad}">${initials}</div>
            ${online ? '<span class="dm-row__online"></span>' : ''}
          </div>
          <div class="dm-row__body">
            <div class="dm-row__name">${esc(m.name || key)}</div>
            <div class="dm-row__preview">${esc(lastMsg.slice(0, 48) || 'Tippen zum schreiben…')}</div>
          </div>
          <div class="dm-row__aside">
            ${lastTs ? `<div class="dm-row__time">${timeAgo(lastTs, state.lang)}</div>` : ''}
            ${unread > 0 ? `<span class="dm-row__pip">${unread}</span>` : ''}
          </div>
        </button>`;
      }).join('')}
    </div>
  `;
}

// ── DM Thread ──────────────────────────────────────────────
function _renderDMThread(el, cu, partner) {
  const u       = state.db.members?.[partner] || {};
  const name    = u.name || partner;
  const grad    = avatarGradient(partner);
  const msgs    = _dmMessages(cu, partner);

  el.innerHTML = `
    <div class="chat-layout">
      <div class="chat-dm-header">
        <button class="chat-back-btn" data-action="chat:dm:back" aria-label="Zurück">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="dm-header-avatar" style="background:${grad}">${partner.slice(0,2).toUpperCase()}</div>
        <div class="dm-header-name">@${esc(name)}</div>
        ${u.online ? '<span class="dm-header-online">● online</span>' : ''}
      </div>

      <div class="pool-messages" id="pool-messages" style="flex:1">
        ${msgs.length === 0
          ? emptyState('✉️', `Schreib @${esc(name)}`, 'Noch keine Nachrichten in diesem Chat', { size: 'sm' })
          : msgs.map(m => _poolBubble(m, cu)).join('')
        }
      </div>

      <div class="chat-input-bar">
        <input
          class="chat-input" id="chat-dm-input"
          type="text" maxlength="400"
          placeholder="@${esc(name)} schreiben…"
          data-action="chat:dm:input"
          autocomplete="off"
        >
        <button class="chat-send-btn" data-action="chat:dm:send" aria-label="Senden">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  `;

  _registerHandlers(cu);
  _scrollToBottom();
  document.getElementById('chat-dm-input')?.focus();
}

// ── Data helpers ───────────────────────────────────────────
function _poolMessages() {
  const raw = state.db.chat?.pool?.messages || {};
  return Object.entries(raw)
    .map(([id, m]) => ({ id, ...m }))
    .filter(m => m.text && m.from)
    .sort((a, b) => (a.ts || 0) - (b.ts || 0))
    .slice(-60);
}

function _dmMessages(cu, partner) {
  const roomKey = [cu, partner].sort().join('__');
  const raw = state.db.chat?.dm?.[roomKey]?.messages || {};
  return Object.entries(raw)
    .map(([id, m]) => ({ id, ...m }))
    .filter(m => m.text && m.from)
    .sort((a, b) => (a.ts || 0) - (b.ts || 0))
    .slice(-60);
}

function _dmThreads(cu) {
  const chat = state.db.chat?.dm || {};
  return Object.entries(chat)
    .filter(([roomKey]) => roomKey.includes(cu))
    .map(([roomKey, room]) => {
      const partner = roomKey.split('__').find(k => k !== cu) || '';
      const msgs    = Object.values(room.messages || {}).sort((a, b) => (b.ts || 0) - (a.ts || 0));
      const last    = msgs[0] || null;
      const unread  = msgs.filter(m => m.from !== cu && !m.read).length;
      return { partner, lastText: last?.text || '', lastTs: last?.ts || 0, unread };
    });
}

// ── Send helpers ───────────────────────────────────────────
function _sendPool(cu) {
  const input = document.getElementById('chat-pool-input');
  const text  = input?.value?.trim();
  if (!text) return;
  input.value = '';
  const msgId = `${Date.now()}_${cu}`;
  const msg   = { from: cu, text, ts: Date.now() };
  // Skip the DB-echo re-render so the keyboard / input bar stay intact
  _skipNextRender = true;
  writeDB(`chat/pool/messages/${msgId}`, msg);
  const msgs = document.getElementById('pool-messages');
  if (msgs) {
    const empty = msgs.querySelector('.empty-state');
    if (empty) empty.remove();
    msgs.insertAdjacentHTML('beforeend', _poolBubble(msg, cu));
  }
  _scrollToBottom();
  input.focus();
}

function _sendDM(cu, partner) {
  const input = document.getElementById('chat-dm-input');
  const text  = input?.value?.trim();
  if (!text || !partner) return;
  input.value = '';
  const roomKey = [cu, partner].sort().join('__');
  const msgId   = `${Date.now()}_${cu}`;
  const msg     = { from: cu, to: partner, text, ts: Date.now() };
  _skipNextRender = true;
  writeDB(`chat/dm/${roomKey}/messages/${msgId}`, msg);
  const msgs = document.getElementById('pool-messages');
  if (msgs) {
    const empty = msgs.querySelector('.empty-state');
    if (empty) empty.remove();
    msgs.insertAdjacentHTML('beforeend', _poolBubble(msg, cu));
  }
  _scrollToBottom();
  input.focus();
}

function _scrollToBottom() {
  setTimeout(() => {
    const box = document.getElementById('pool-messages');
    if (box) box.scrollTop = box.scrollHeight;
  }, 20);
}

function _focusInput() {
  setTimeout(() => document.getElementById('chat-pool-input')?.focus(), 50);
}

// ── Handlers ───────────────────────────────────────────────
function _registerHandlers(cu) {
  on('chat:tab', (el) => {
    _chatTab   = el.dataset.tab || 'pool';
    _dmPartner = null;
    render();
  });

  on('chat:pool:send', () => _sendPool(cu));

  on('chat:pool:input', (el, e) => {
    if (e.type === 'keydown' && e.key === 'Enter') _sendPool(cu);
  });

  on('chat:dm:open', (el) => {
    _dmPartner = el.dataset.partner;
    render();
  });

  on('chat:dm:back', () => {
    _dmPartner = null;
    render();
  });

  on('chat:dm:send', () => _sendDM(cu, _dmPartner));

  on('chat:dm:input', (el, e) => {
    if (e.type === 'keydown' && e.key === 'Enter') _sendDM(cu, _dmPartner);
  });
}
