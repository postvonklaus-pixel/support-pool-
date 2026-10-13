/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Video Posting
   ═══════════════════════════════════════════════════════ */

import { state }   from '../state.js';
import { t }       from '../i18n.js';
import { writeDB } from '../firebase.js';
import { toast }   from '../components/toast.js';
import { openModal, closeModal } from '../components/modal.js';
import { on }      from '../events.js';

const R1_MS   = 24 * 60 * 60 * 1000;
const R1_NEED = 10;

export function openPostModal() {
  const cu = state.currentUser;
  if (!cu) return;

  const u     = state.db.members?.[cu] || {};
  const stats = u.stats || {};
  const given = stats.given    || 0;
  const recv  = stats.received || 0;
  const bal   = given - recv;
  const tot   = u.postsTotal  || 0;

  // Cooldown check
  if (u.lastPost && (Date.now() - u.lastPost) < R1_MS) {
    const rem = R1_MS - (Date.now() - u.lastPost);
    const h   = Math.floor(rem / 3600000);
    const m   = Math.floor((rem % 3600000) / 60000);
    toast(`⏳ Noch ${h}h ${m}m warten`, 'warning', 4000);
    return;
  }

  // Balance check (after first 2 videos)
  if (tot >= 2 && bal < 0) {
    toast(`❌ Balance: ${bal}. Erst ${Math.abs(bal)} Supports geben!`, 'error', 5000);
    return;
  }

  openModal({
    id: 'post-modal',
    title: '🎬 Video posten',
    body: `
      <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px">
        TikTok-Video-Link einfügen:
      </p>
      <div class="input-wrap">
        <input id="post-url-input" class="input input--lg" type="url" placeholder="https://www.tiktok.com/..." autocomplete="off">
      </div>
      <div id="post-url-error" style="color:var(--danger);font-size:12px;margin-top:6px;display:none"></div>
      <button class="btn btn--primary btn--full" data-action="post:submit" style="margin-top:16px">
        ✓ Posten
      </button>
    `,
  });

  // Focus input after modal renders
  setTimeout(() => document.getElementById('post-url-input')?.focus(), 150);
}

on('post:submit', () => {
  const input = document.getElementById('post-url-input');
  const url   = (input?.value || '').trim();
  const err   = document.getElementById('post-url-error');

  if (!url || !url.includes('tiktok.com')) {
    if (err) { err.textContent = 'Bitte gültigen TikTok-Link eingeben'; err.style.display = ''; }
    return;
  }

  const cu = state.currentUser;
  if (!cu) return;

  // Duplicate URL check — same link already in the pool
  const duplicate = Object.values(state.db.videos || {}).find(
    v => (v.link || v.url || '').trim() === url && v.status !== 'done' && v.status !== 'expired'
  );
  if (duplicate) {
    if (err) { err.textContent = 'Dieses Video ist bereits im Pool'; err.style.display = ''; }
    return;
  }

  const id = `vid_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
  const u  = state.db.members?.[cu] || {};

  writeDB(`videos/${id}`, {
    id, link: url, owner: cu, ownerKey: cu.toLowerCase(),
    status: 'open', round: 1,
    r1Supporters: [], r2Supporters: [],
    r1Need: R1_NEED,
    postedAt: Date.now(),
  });

  writeDB(`members/${cu}/lastPost`,    Date.now());
  writeDB(`members/${cu}/postsTotal`,  (u.postsTotal || 0) + 1);

  closeModal('post-modal');
  toast('Video gepostet! 🎉', 'success');
});
