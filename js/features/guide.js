/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Guide / Onboarding
   ═══════════════════════════════════════════════════════ */

import { openModal } from '../components/modal.js';
import { t }         from '../i18n.js';
import { esc }       from '../utils.js';

export function openGuide() {
  openModal({
    id: 'guide-modal',
    title: '📖 Guide: NOVA Support Pool',
    body: `
      <div style="line-height:1.7;color:var(--text-secondary);font-size:14px">
        <div style="margin-bottom:16px">
          <div style="font-weight:700;color:var(--text-primary);margin-bottom:6px">🎯 Wie funktioniert's?</div>
          <p>Der NOVA Support Pool ist eine gegenseitige TikTok-Support-Community. Du kommentierst auf anderen Videos — andere kommentieren auf deinen.</p>
        </div>
        <div style="margin-bottom:16px">
          <div style="font-weight:700;color:var(--text-primary);margin-bottom:6px">💰 Guthaben</div>
          <p>Jeder Support den du gibst = +1. Jeder den du bekommst = −1. Balance = Gegeben − Erhalten (max. +20). Negatives Guthaben blockiert neue Posts.</p>
        </div>
        <div style="margin-bottom:16px">
          <div style="font-weight:700;color:var(--text-primary);margin-bottom:6px">🎬 Video posten</div>
          <p>Klicke auf „Video posten" und füge deinen TikTok-Link ein. Nach 24h kann ein neues Video gepostet werden.</p>
        </div>
        <div style="margin-bottom:16px">
          <div style="font-weight:700;color:var(--text-primary);margin-bottom:6px">🏆 Ranking</div>
          <ul style="padding-left:18px">
            <li>🏆 Neuling — 1–4 Supports</li>
            <li>🏆🏆 Aufsteiger — 5–19 Supports</li>
            <li>🏆🏆🏆 Aktiv — 20–49 Supports</li>
            <li>🏆🏆🏆🏆 Veteran — 50–99 Supports</li>
            <li>🏆🏆🏆🏆🏆 Elite — 100+ Supports</li>
          </ul>
        </div>
      </div>
    `,
  });
}
