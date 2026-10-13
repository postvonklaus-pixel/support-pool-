/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Notifications Helper
   ═══════════════════════════════════════════════════════ */

import { state }   from '../state.js';
import { writeDB } from '../firebase.js';
import { toast }   from '../components/toast.js';
import { openModal, closeModal } from '../components/modal.js';
import { esc }     from '../utils.js';
import { on }      from '../events.js';

export function delNotif(id) {
  if (!id) return;
  writeDB(`messages/${id}`, null);
  toast('Gelöscht', 'success', 1800);
}

export function openReply(toKey) {
  if (!toKey) return;
  const u    = state.db.members?.[toKey];
  const name = u?.name || toKey;

  openModal({
    id: 'reply-modal',
    title: `↩ Antwort an @${esc(name)}`,
    body: `
      <div class="input-wrap">
        <textarea id="reply-text" class="textarea" rows="3" placeholder="Nachricht..."></textarea>
      </div>
      <button class="btn btn--primary btn--full" data-action="notif:reply:send" data-to="${esc(toKey)}" style="margin-top:12px">
        Senden ✉️
      </button>
    `,
  });

  setTimeout(() => document.getElementById('reply-text')?.focus(), 150);
}

on('notif:reply:send', (el) => {
  const toKey = el.dataset.to;
  const text  = document.getElementById('reply-text')?.value?.trim();

  if (!text) { toast('Nachricht eingeben', 'warning'); return; }

  const cu = state.currentUser;
  if (!cu) return;

  // Write to the DM chat path — same structure chat.js uses — so the
  // message appears in the Chat → Direkt thread instead of disappearing
  // into the notification inbox.
  const roomKey = [cu, toKey].sort().join('__');
  const msgId   = `${Date.now()}_${cu}`;
  writeDB(`chat/dm/${roomKey}/messages/${msgId}`, {
    from: cu, to: toKey, text, ts: Date.now(),
  });

  // Also write a notification badge so the recipient sees the DM pip
  const notifId = `dm_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
  writeDB(`messages/${notifId}`, {
    to: toKey, from: cu, type: 'dm',
    icon: '✉️', message: text,
    ts: Date.now(), read: false,
  });

  closeModal('reply-modal');
  toast('Gesendet! ✉️', 'success');
});
