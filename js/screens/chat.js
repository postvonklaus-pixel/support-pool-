/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Chat Screen  (Part D)
   Tabs: Pool-Chat | Direkt-Nachrichten
   ═══════════════════════════════════════════════════════ */

import { state }    from '../state.js';
import { t }        from '../i18n.js';
import { esc, timeAgo, avatarGradient, fbDec } from '../utils.js';
import { on }       from '../events.js';
import { writeDB }  from '../firebase.js';
import { emptyState } from '../components/empty-state.js';
import { getOnlineCount } from '../features/presence.js';

let _chatTab        = 'pool';  // 'pool' | 'dm'
let _dmPartner      = null;    // username of open DM thread
let _skipNextRender = false;   // set after in-place send to skip DB-echo re-render
let _renderTimer    = null;    // debounce handle for DB-triggered re-renders
let _replyTo        = null;    // { from, text } | null — pending reply context
let _activeBubbleId = null;    // id of bubble whose action bar is open

const REACT_EMOJIS = ['👍','❤️','😂','😮','🔥','👏'];

let _typingTimer = null;

function _onTyping() {
  const cu = state.currentUser;
  if (!cu) return;
  if (_chatTab === 'pool') {
    writeDB(`chat/pool/typing/${cu}`, Date.now());
  } else if (_dmPartner) {
    const roomKey = [cu, _dmPartner].sort().join('__');
    writeDB(`chat/dm/${roomKey}/typing/${cu}`, Date.now());
  }
  clearTimeout(_typingTimer);
  _typingTimer = setTimeout(_clearTyping, 3000);
}

function _clearTyping() {
  clearTimeout(_typingTimer);
  const cu = state.currentUser;
  if (!cu) return;
  if (_chatTab === 'pool') {
    writeDB(`chat/pool/typing/${cu}`, null);
  } else if (_dmPartner) {
    const roomKey = [cu, _dmPartner].sort().join('__');
    writeDB(`chat/dm/${roomKey}/typing/${cu}`, null);
  }
}

function _typingIndicatorHtml(cu) {
  const now   = Date.now();
  const STALE = 5000;
  let typers  = [];

  if (_dmPartner) {
    const roomKey = [cu, _dmPartner].sort().join('__');
    const typing  = state.db.chat?.dm?.[roomKey]?.typing || {};
    typers = Object.entries(typing)
      .filter(([k, v]) => k !== cu && typeof v === 'number' && now - v < STALE)
      .map(([k]) => k);
  } else {
    const typing = state.db.chat?.pool?.typing || {};
    typers = Object.entries(typing)
      .filter(([k, v]) => k !== cu && typeof v === 'number' && now - v < STALE)
      .map(([k]) => k);
  }

  if (!typers.length) return `<div class="typing-indicator typing-indicator--empty" id="typing-indicator"></div>`;
  const names = typers.slice(0, 3).map(k => `@${esc(k)}`).join(', ');
  const verb  = typers.length === 1 ? 'tippt' : 'tippen';
  return `<div class="typing-indicator" id="typing-indicator">
    <span class="typing-dots"><span></span><span></span><span></span></span>
    <span class="typing-text">${names} ${verb}…</span>
  </div>`;
}

function _patchTypingIndicator(cu) {
  const html     = _typingIndicatorHtml(cu);
  const existing = document.getElementById('typing-indicator');
  if (existing) {
    existing.outerHTML = html;
  } else {
    const form = document.getElementById('chat-pool-form') || document.getElementById('chat-dm-form');
    form?.insertAdjacentHTML('beforebegin', html);
  }
}

export function scheduleRender() {
  clearTimeout(_renderTimer);
  _renderTimer = setTimeout(render, 120);
}

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

  const msgsBox  = document.getElementById('pool-messages');
  const atBottom = !msgsBox || msgsBox.scrollTop + msgsBox.clientHeight >= msgsBox.scrollHeight - 40;
  const prevInput = document.getElementById('chat-pool-input')?.value ||
                    document.getElementById('chat-dm-input')?.value || '';

  // If the chat input is focused during a DB-triggered re-render, only patch
  // the message list instead of replacing the entire DOM. Replacing innerHTML
  // destroys the focused <form> which causes iOS to close the keyboard.
  const inputFocused = document.activeElement?.id === 'chat-pool-input';
  if (inputFocused && _chatTab === 'pool' && !_dmPartner && el.classList.contains('active')) {
    _activeBubbleId = null; // close any open action bar on external update
    const poolMsgs = _poolMessages();
    if (msgsBox) {
      msgsBox.innerHTML = poolMsgs.length === 0
        ? '<div class="pool-messages-empty"></div>'
        : poolMsgs.map(m => _poolBubble(m, cu)).join('');
      if (atBottom) _scrollToBottom();
    }
    _patchTypingIndicator(cu);
    return;
  }

  if (_dmPartner) {
    _renderDMThread(el, cu, _dmPartner);
    return;
  }

  _activeBubbleId = null;

  const poolMsgs  = _poolMessages();
  const dmThreads = _dmThreads(cu);
  const unreadDM  = dmThreads.reduce((s, t) => s + t.unread, 0);

  el.innerHTML = `
    <div class="chat-layout">
      <div class="chat-tabs">
        <button class="chat-tab ${_chatTab==='pool'?'chat-tab--active':''}"
          data-action="chat:tab" data-tab="pool">
          ${t('chatTabPool')}
        </button>
        <button class="chat-tab ${_chatTab==='dm'?'chat-tab--active':''}"
          data-action="chat:tab" data-tab="dm">
          ${t('chatTabDirect')}
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
    // Re-inject reply bar if still pending
    if (_replyTo) _showReplyBar();
    // Scroll to bottom only if we were already there
    if (atBottom) _scrollToBottom();
  }
}

// ── Pool Chat ──────────────────────────────────────────────
function _renderPool(cu, msgs) {
  const onlineCount = getOnlineCount();
  const onlineTxt   = onlineCount === 0
    ? '— niemand online'
    : `🟢 ${onlineCount} online`;

  return `
    <div class="pool-chat-header">
      <span class="pool-online-badge" id="pool-online-count">${onlineTxt}</span>
    </div>
    <div class="pool-messages" id="pool-messages">
      ${msgs.length === 0
        ? emptyState('💬', t('chatPoolEmpty'), t('chatPoolEmptySub'), { size: 'sm' })
        : msgs.map(m => _poolBubble(m, cu)).join('')
      }
    </div>
    ${_typingIndicatorHtml(cu)}
    <form class="chat-input-bar" id="chat-pool-form" action="javascript:void(0)">
      <textarea
        class="chat-input" id="chat-pool-input"
        rows="1" maxlength="400"
        placeholder="${t('chatPoolPlaceholder')}"
        data-action="chat:pool:input"
        autocomplete="off"
      ></textarea>
      <button type="submit" class="chat-send-btn" aria-label="${t('chatSend') || 'Senden'}">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </form>
  `;
}

function _poolBubble(m, cu, { roomKey = '' } = {}) {
  // System messages (Tickets 2+3) — no avatar, no reply, no reactions
  if (m.type === 'system') {
    return `
      <div class="sys-msg" role="status">
        <span class="sys-msg__line"></span>
        <span class="sys-msg__text">${esc(m.text || '')}</span>
        <span class="sys-msg__line"></span>
      </div>
    `;
  }

  const isMe     = m.from === cu;
  const u        = state.db.members?.[m.from] || {};
  const name     = u.name || fbDec(m.from) || '?';
  const grad     = avatarGradient(m.from || '');
  const initials = (m.from || '?').slice(0, 2).toUpperCase();
  const textHtml = esc(m.text || '').replace(/\n/g, '<br>');

  // Reply quote block
  const quoteHtml = m.replyTo ? `
    <div class="bubble-quote">
      <span class="bubble-quote__from">@${esc(m.replyTo.from || '')}</span>
      <span class="bubble-quote__text">${esc((m.replyTo.text || '').slice(0, 60))}</span>
    </div>
  ` : '';

  // Reactions row
  const reactHtml = _reactionsHtml(m, cu, roomKey);

  // Action bar (emoji picker + reply + admin delete)
  const showActions = m.id && _activeBubbleId === m.id;
  const isAdmin = state.db.members?.[cu]?.role === 'admin';
  const actionsHtml = showActions ? `
    <div class="bubble-actions${isMe ? ' bubble-actions--me' : ''}">
      ${REACT_EMOJIS.map(e => `<button class="bubble-action-emoji" data-action="chat:react" data-msg-id="${m.id}" data-emoji="${e}" data-room-key="${roomKey}">${e}</button>`).join('')}
      <button class="bubble-action-reply" data-action="chat:reply" data-msg-from="${esc(m.from || '')}" data-msg-text="${esc(m.text || '')}">↩</button>
      ${isAdmin ? `<button class="bubble-action-delete" data-action="chat:msg:delete" data-msg-id="${m.id}" data-room-key="${roomKey}" title="Löschen">🗑</button>` : ''}
    </div>
  ` : '';

  return `
    <div class="bubble-row ${isMe ? 'bubble-row--me' : ''}">
      ${!isMe ? `<div class="bubble-avatar" style="background:${grad}" title="@${esc(m.from || '')}">${initials}</div>` : ''}
      <div class="bubble-col">
        ${!isMe ? `<div class="bubble-meta"><span class="bubble-username">@${esc(name)}</span><span class="bubble-time-inline">${m.ts ? timeAgo(m.ts, state.lang) : ''}</span></div>` : ''}
        <div class="bubble ${isMe ? 'bubble--me' : 'bubble--them'}"
          data-action="chat:bubble:tap" data-msg-id="${m.id || ''}">
          ${quoteHtml}${textHtml}
        </div>
        ${reactHtml}
        ${actionsHtml}
        ${isMe ? `<div class="bubble-time">${m.ts ? timeAgo(m.ts, state.lang) : ''}</div>` : ''}
      </div>
    </div>
  `;
}

function _reactionsHtml(m, cu, roomKey) {
  const r = m.reactions;
  if (!r || typeof r !== 'object') return '';
  const entries = Object.entries(r).filter(([, users]) =>
    users && typeof users === 'object' && Object.keys(users).length > 0
  );
  if (!entries.length) return '';
  return `<div class="bubble-reactions">
    ${entries.map(([emoji, users]) => {
      const count = Object.keys(users).length;
      const mine  = !!users[cu];
      return `<button class="reaction-chip${mine ? ' reaction-chip--mine' : ''}"
        data-action="chat:react" data-msg-id="${m.id}" data-emoji="${emoji}" data-room-key="${roomKey}">
        ${emoji}${count > 1 ? ` ${count}` : ''}
      </button>`;
    }).join('')}
  </div>`;
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
    return emptyState('👥', t('chatDMListEmpty'), t('chatDMListEmptySub'));
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
            <div class="dm-row__name">${esc(m.name || fbDec(key))}</div>
            <div class="dm-row__preview">${esc(lastMsg.slice(0, 48) || t('chatDMPreview'))}</div>
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
  const name    = u.name || fbDec(partner);
  const grad    = avatarGradient(partner);
  const roomKey = [cu, partner].sort().join('__');
  const msgs    = _dmMessages(cu, partner);

  _activeBubbleId = null;

  // Mark all incoming unread messages as read so the DM pip clears
  const raw = state.db.chat?.dm?.[roomKey]?.messages || {};
  Object.entries(raw)
    .filter(([, m]) => m.from !== cu && !m.read)
    .forEach(([id]) => writeDB(`chat/dm/${roomKey}/messages/${id}/read`, true));

  el.innerHTML = `
    <div class="chat-layout">
      <div class="chat-dm-header">
        <button class="chat-back-btn" data-action="chat:dm:back" aria-label="Zurück">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="dm-header-avatar" style="background:${grad}">${partner.slice(0,2).toUpperCase()}</div>
        <div class="dm-header-name">@${esc(name)}</div>
        ${u.online ? `<span class="dm-header-online">● ${(t('online') || 'online').toLowerCase()}</span>` : ''}
      </div>

      <div class="pool-messages" id="pool-messages" style="flex:1">
        ${msgs.length === 0
          ? emptyState('✉️', `@${esc(name)}`, t('chatDMEmpty'), { size: 'sm' })
          : msgs.map(m => _poolBubble(m, cu, { roomKey })).join('')
        }
      </div>

      ${_typingIndicatorHtml(cu)}
      <form class="chat-input-bar" id="chat-dm-form" action="javascript:void(0)">
        <textarea
          class="chat-input" id="chat-dm-input"
          rows="1" maxlength="400"
          placeholder="${t('chatDMPlaceholder').replace('{name}', esc(name))}"
          data-action="chat:dm:input"
          autocomplete="off"
        ></textarea>
        <button type="submit" class="chat-send-btn" aria-label="${t('chatSend') || 'Senden'}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </form>
    </div>
  `;

  _registerHandlers(cu);
  if (_replyTo) _showReplyBar();
  _scrollToBottom();
  document.getElementById('chat-dm-input')?.focus();
}

// ── Data helpers ───────────────────────────────────────────
function _poolMessages() {
  const raw = state.db.chat?.pool?.messages || {};
  return Object.entries(raw)
    .map(([id, m]) => ({ id, ...m }))
    .filter(m => m.text && (m.from || m.type === 'system'))
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

// ── Re-render messages area only (preserves input / reply bar) ──
function _rerenderMessages() {
  const cu = state.currentUser;
  if (!cu) return;
  const msgsBox = document.getElementById('pool-messages');
  if (!msgsBox) return;

  if (_dmPartner) {
    const roomKey = [cu, _dmPartner].sort().join('__');
    const msgs = _dmMessages(cu, _dmPartner);
    msgsBox.innerHTML = msgs.length === 0
      ? emptyState('✉️', `@${esc(_dmPartner)}`, t('chatDMEmpty'), { size: 'sm' })
      : msgs.map(m => _poolBubble(m, cu, { roomKey })).join('');
  } else {
    const msgs = _poolMessages();
    msgsBox.innerHTML = msgs.length === 0
      ? '<div class="pool-messages-empty"></div>'
      : msgs.map(m => _poolBubble(m, cu)).join('');
  }
}

// ── Reply bar ──────────────────────────────────────────────
function _showReplyBar() {
  document.getElementById('reply-bar')?.remove();
  if (!_replyTo) return;
  const form = document.getElementById('chat-pool-form') || document.getElementById('chat-dm-form');
  if (!form) return;
  form.insertAdjacentHTML('beforebegin', `
    <div class="reply-bar" id="reply-bar">
      <span class="reply-bar__icon">↩</span>
      <div class="reply-bar__body">
        <div class="reply-bar__from">@${esc(_replyTo.from)}</div>
        <div class="reply-bar__text">${esc((_replyTo.text || '').slice(0, 60))}</div>
      </div>
      <button class="reply-bar__close" data-action="chat:reply:cancel">✕</button>
    </div>
  `);
}

// ── Send helpers ───────────────────────────────────────────
function _sendPool(cu) {
  const input = document.getElementById('chat-pool-input');
  const text  = input?.value?.trim();
  if (!text) return;
  input.value = '';
  input.style.height = '';
  const msgId = `${Date.now()}_${cu}`;
  const msg   = { from: cu, text, ts: Date.now() };

  if (_replyTo) {
    msg.replyTo = { from: _replyTo.from, text: _replyTo.text.slice(0, 80) };
    _replyTo = null;
    document.getElementById('reply-bar')?.remove();
  }

  // Clear typing indicator and skip the DB-echo re-render
  _clearTyping();
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
  input.style.height = '';
  const roomKey = [cu, partner].sort().join('__');
  const msgId   = `${Date.now()}_${cu}`;
  const msg     = { from: cu, to: partner, text, ts: Date.now() };

  if (_replyTo) {
    msg.replyTo = { from: _replyTo.from, text: _replyTo.text.slice(0, 80) };
    _replyTo = null;
    document.getElementById('reply-bar')?.remove();
  }

  _clearTyping();
  _skipNextRender = true;
  writeDB(`chat/dm/${roomKey}/messages/${msgId}`, msg);
  const msgs = document.getElementById('pool-messages');
  if (msgs) {
    const empty = msgs.querySelector('.empty-state');
    if (empty) empty.remove();
    msgs.insertAdjacentHTML('beforeend', _poolBubble(msg, cu, { roomKey }));
  }
  _scrollToBottom();
  input.focus();
}

function _autoResize(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 96) + 'px';
}

function _scrollToBottom() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const box = document.getElementById('pool-messages');
    if (box) box.scrollTop = box.scrollHeight;
  }));
}

// ── Handlers ───────────────────────────────────────────────
function _registerHandlers(cu) {
  // iOS Safari only keeps keyboard open on form submit — not on button tap.
  // Wrapping the input bar in <form> with type="submit" button is the only reliable fix.
  document.getElementById('chat-pool-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    _sendPool(cu);
  });
  document.getElementById('chat-dm-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    _sendDM(cu, _dmPartner);
  });

  on('chat:tab', (el) => {
    _clearTyping();
    _chatTab   = el.dataset.tab || 'pool';
    _dmPartner = null;
    _replyTo   = null;
    _activeBubbleId = null;
    render();
  });

  on('chat:pool:send', () => _sendPool(cu));

  on('chat:pool:input', (el, e) => {
    if (e.type === 'keydown' && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      _sendPool(cu);
    } else if (e.type === 'input') {
      _autoResize(el);
      _onTyping();
    }
  });

  on('chat:dm:open', (el) => {
    _dmPartner = el.dataset.partner;
    _replyTo   = null;
    _activeBubbleId = null;
    render();
  });

  on('chat:dm:back', () => {
    _clearTyping();
    _dmPartner = null;
    _replyTo   = null;
    _activeBubbleId = null;
    render();
  });

  on('chat:dm:send', () => _sendDM(cu, _dmPartner));

  on('chat:dm:input', (el, e) => {
    if (e.type === 'keydown' && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      _sendDM(cu, _dmPartner);
    } else if (e.type === 'input') {
      _autoResize(el);
      _onTyping();
    }
  });

  // ── Ticket 4: Bubble tap → action bar ───────────────────
  on('chat:bubble:tap', (el) => {
    const msgId = el.dataset.msgId;
    if (!msgId) return;
    _activeBubbleId = (_activeBubbleId === msgId) ? null : msgId;
    _rerenderMessages();
  });

  // ── Ticket 4: Emoji reaction toggle ─────────────────────
  on('chat:react', (el) => {
    const msgId   = el.dataset.msgId;
    const emoji   = el.dataset.emoji;
    const roomKey = el.dataset.roomKey || '';
    if (!msgId || !emoji) return;

    _activeBubbleId = null;

    const path = roomKey
      ? `chat/dm/${roomKey}/messages/${msgId}/reactions/${emoji}/${cu}`
      : `chat/pool/messages/${msgId}/reactions/${emoji}/${cu}`;

    // Check current reaction state
    const already = roomKey
      ? !!state.db.chat?.dm?.[roomKey]?.messages?.[msgId]?.reactions?.[emoji]?.[cu]
      : !!state.db.chat?.pool?.messages?.[msgId]?.reactions?.[emoji]?.[cu];

    writeDB(path, already ? null : true);
    _rerenderMessages();
  });

  // ── Ticket 4: Reply ──────────────────────────────────────
  on('chat:reply', (el) => {
    _replyTo = { from: el.dataset.msgFrom || '', text: el.dataset.msgText || '' };
    _activeBubbleId = null;
    _rerenderMessages();
    _showReplyBar();
    setTimeout(() => {
      (document.getElementById('chat-pool-input') ||
       document.getElementById('chat-dm-input'))?.focus();
    }, 50);
  });

  on('chat:reply:cancel', () => {
    _replyTo = null;
    document.getElementById('reply-bar')?.remove();
  });

  // ── Admin: delete message ────────────────────────────────
  on('chat:msg:delete', async (el) => {
    const msgId   = el.dataset.msgId;
    const roomKey = el.dataset.roomKey || '';
    if (!msgId) return;
    const { confirm } = await import('../components/modal.js');
    const ok = await confirm('Nachricht löschen?', 'Diese Aktion ist nicht rückgängig zu machen.');
    if (!ok) return;
    _activeBubbleId = null;
    const path = roomKey
      ? `chat/dm/${roomKey}/messages/${msgId}`
      : `chat/pool/messages/${msgId}`;
    writeDB(path, null);
    _rerenderMessages();
  });
}
