/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Video Preview Modal
   ═══════════════════════════════════════════════════════ */

import { state }      from '../state.js';
import { t }          from '../i18n.js';
import { esc, avatarGradient, fbDec } from '../utils.js';
import { trustBadge } from './trust.js';
import { isVerified, VERIFIED_BADGE } from './verification.js';
import { goalPill }   from '../components/progress.js';

const R2_NEED = 10;

export function openVideoPreview(vidId) {
  if (!vidId) return;
  const videos = state.db.videos || {};
  const v = Object.values(videos).find(v2 => (v2.id || v2.link || v2.url) === vidId)
         || videos[vidId];
  if (!v) return;

  closeVideoPreview();

  const owner     = fbDec(v.ownerKey || v.owner || '?');
  const gradient  = avatarGradient(owner);
  const ownerData = state.db.members?.[owner] || state.db.members?.[owner.toLowerCase()] || {};
  const verBadge  = isVerified(ownerData) ? VERIFIED_BADGE : '';
  const trust     = trustBadge(owner);
  const round     = v.round || 1;
  const r1        = (v.r1Supporters || []).length;
  const r2        = (v.r2Supporters || []).length;
  const r1n       = v.r1Need || (state.db.settings?.r1Need || 10);
  const r2n       = R2_NEED;
  const current   = round >= 2 ? r2 : r1;
  const total     = round >= 2 ? r2n : r1n;
  const link      = v.link || v.url || '#';

  const thumbHtml = v.thumbnail
    ? `<img class="vpm-thumb" src="${esc(v.thumbnail)}" alt="${esc(v.videoTitle || '')}" loading="lazy"/>`
    : `<div class="vpm-thumb-fallback">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        <span>${t('videoPreviewUnavailable') || 'Vorschau nicht verfügbar'}</span>
       </div>`;

  const modal = document.createElement('div');
  modal.className = 'video-preview-modal';
  modal.dataset.vid = vidId;
  modal.innerHTML = `
    <div class="vpm-overlay" data-action="vpm:close"></div>
    <div class="vpm-content">
      <button class="vpm-close btn" data-action="vpm:close" aria-label="Schließen">✕</button>

      <div class="vpm-thumb-wrap">
        ${thumbHtml}
        <div class="vpm-play-overlay" aria-hidden="true">
          <svg class="vpm-play" width="56" height="56" viewBox="0 0 24 24" fill="white">
            <polygon points="8 5 19 12 8 19 8 5"/>
          </svg>
        </div>
      </div>

      <div class="vpm-info">
        <div class="vpm-owner">
          <div class="vpm-avatar" style="background:${gradient}">${owner.slice(0,2).toUpperCase()}</div>
          <span class="vpm-owner-name">${trust}${verBadge} @${esc(owner)}</span>
          <span class="round-pill round-pill--r${round}" style="margin-left:auto">R${round}</span>
        </div>

        ${v.videoTitle ? `<div class="vpm-title">${esc(v.videoTitle)}</div>` : ''}

        <div class="vpm-stats-grid">
          <div class="vpm-stat">
            <span class="vpm-stat-num">${current}</span>
            <span class="vpm-stat-lbl">${t('vpmSupports') || 'Supports'}</span>
          </div>
          <div class="vpm-stat">
            <span class="vpm-stat-num">${total - current}</span>
            <span class="vpm-stat-lbl">${t('vpmSlotsLeft') || 'Slots frei'}</span>
          </div>
          <div class="vpm-stat">
            <span class="vpm-stat-num">${round}</span>
            <span class="vpm-stat-lbl">${t('vpmRound') || 'Runde'}</span>
          </div>
        </div>

        <div style="margin-bottom:12px">
          ${goalPill(current, total, 'Slots', { urgent: (total - current) <= 3 })}
        </div>

        <a class="vpm-open-link btn" href="${esc(link)}" target="_blank" rel="noopener noreferrer"
           data-action="vpm:support" data-vid="${esc(vidId)}">
          ${t('supportOpen') || 'Support geben & TikTok öffnen'} →
        </a>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => modal.classList.add('active'));
}

export function closeVideoPreview() {
  const modal = document.querySelector('.video-preview-modal');
  if (!modal) return;
  modal.classList.remove('active');
  document.body.style.overflow = '';
  setTimeout(() => modal.remove(), 250);
}
