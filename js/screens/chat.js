/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Chat Screen (stub for Part D)
   ═══════════════════════════════════════════════════════ */

import { state } from '../state.js';
import { t }     from '../i18n.js';
import { esc }   from '../utils.js';

export function render() {
  const el = document.getElementById('screen-chat');
  if (!el) return;

  el.innerHTML = `
    <div class="page-header">
      <div class="page-header__title">Chat</div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh;gap:16px;padding:24px;text-align:center">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
      </svg>
      <div style="font-size:var(--text-lg);font-weight:var(--weight-semibold);color:var(--text-primary)">Pool-Chat</div>
      <div style="font-size:var(--text-sm);color:var(--text-tertiary);max-width:260px">
        Gruppen-Chat und Direktnachrichten — kommt bald in Teil D
      </div>
    </div>
  `;
}
