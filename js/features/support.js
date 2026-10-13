/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Support Flow
   ═══════════════════════════════════════════════════════ */

import { state }   from '../state.js';
import { t }       from '../i18n.js';
import { esc }     from '../utils.js';
import { writeDB } from '../firebase.js';
import { toast }   from '../components/toast.js';
import { openModal, closeModal } from '../components/modal.js';
import { confetti } from '../components/confetti.js';
import { on }      from '../events.js';

const COMMENTS = {
  de: ['Super Video! Weiter so! 🔥','Tolles Content, macht weiter! 💪','Guter Inhalt, danke fürs Teilen! 👍','Sehr hilfreich, weiter so! ⭐','Klasse Video! 🎉'],
  en: ['Great video! Keep it up! 🔥','Awesome content! 💪','Good stuff, thanks for sharing! 👍','Very helpful, keep going! ⭐','Love this video! 🎉'],
};

export function handleSupport(vidId) {
  if (!vidId) return;
  const v = _findVideo(vidId);
  if (!v) { toast('Video nicht gefunden', 'error'); return; }

  const cu     = state.currentUser;
  const u      = state.db.members?.[cu] || {};
  const link   = v.link || v.url || '';
  const lang   = state.lang;
  const pool   = COMMENTS[lang] || COMMENTS.de;

  const commentsHTML = pool.map(c =>
    `<button class="btn btn--ghost btn--full" style="text-align:left;margin-bottom:8px" data-action="support:copy" data-comment="${esc(c)}">${esc(c)}</button>`
  ).join('');

  openModal({
    id: 'support-modal',
    title: '💬 Support-Kommentar',
    body: `
      <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px">
        Kommentiere auf TikTok, dann auf „Erledigt" klicken:
      </p>
      <a href="${esc(link)}" target="_blank" rel="noopener" class="btn btn--primary btn--full" style="margin-bottom:16px">
        🔗 Video öffnen
      </a>
      <div class="divider" style="margin-bottom:16px"></div>
      <div style="font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:8px">Kommentar wählen:</div>
      ${commentsHTML}
      <button class="btn btn--success btn--full" data-action="support:done" data-vid="${esc(vidId)}" style="margin-top:8px">
        ✓ Erledigt
      </button>
    `,
  });
}

export function copyComment(comment) {
  if (!comment) return;
  navigator.clipboard?.writeText(comment)
    .then(() => toast('Kopiert! 📋', 'success', 1800))
    .catch(() => toast(comment, 'info', 6000));
}

on('support:done', (el) => {
  const vidId = el.dataset.vid;
  if (!vidId) return;

  const cu = state.currentUser;
  if (!cu) return;

  const v = _findVideo(vidId);
  if (!v) return;

  const rnd    = v.round || 1;
  const field  = rnd === 1 ? 'r1Supporters' : 'r2Supporters';
  const cuLow  = cu.toLowerCase();
  const supporters = (rnd === 1 ? v.r1Supporters : v.r2Supporters) || [];

  if (supporters.map(k => k.toLowerCase()).includes(cuLow)) {
    toast('Bereits supportet', 'warning');
    closeModal('support-modal');
    return;
  }

  const newSups = [...supporters, cu];
  const dbVidId = _findVideoId(vidId);

  // Update supporters list
  writeDB(`videos/${dbVidId}/${field}`, newSups);

  // Update stats
  const u = state.db.members?.[cu] || {};
  const stats = u.stats || {};
  writeDB(`members/${cu}/stats/given`, (stats.given || 0) + 1);
  writeDB(`members/${cu}/weeklyGiven`, (u.weeklyGiven || 0) + 1);

  // Record today as support day
  const today = new Date().toISOString().slice(0, 10);
  const days  = [...new Set([...(u.supportDays || []), today])];
  writeDB(`members/${cu}/supportDays`, days);

  // Notify video owner
  const owner = v.ownerKey || v.owner;
  if (owner && owner !== cu) {
    const notifId = `notif_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    writeDB(`messages/${notifId}`, {
      to: owner, from: cu, type: 'notif',
      icon: '💬', message: `@${cu} hat dein Video supportet! 💪`,
      ts: Date.now(), read: false,
    });
  }

  closeModal('support-modal');
  confetti();
  toast('Support gegeben! 🎉', 'success');
});

function _findVideo(vidId) {
  return Object.values(state.db.videos || {}).find(v =>
    v.id === vidId || v.link === vidId || v.url === vidId
  );
}

function _findVideoId(vidId) {
  const entry = Object.entries(state.db.videos || {}).find(([, v]) =>
    v.id === vidId || v.link === vidId || v.url === vidId
  );
  return entry ? entry[0] : vidId;
}
