/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Modal Component (Dialog-based)
   ═══════════════════════════════════════════════════════ */

import { ge } from '../utils.js';
import { state, setState } from '../state.js';

const _stack = [];

/**
 * Open a modal.
 * @param {object} opts - { id, title, body (HTML string), actions }
 */
export function openModal({ id, title, body = '', actions = [] }) {
  const container = ge('modal-container');
  if (!container) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.dataset.modal = id;
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-labelledby', `modal-title-${id}`);

  const actionsHTML = actions.map(a =>
    `<button class="btn ${a.class || 'btn--secondary'}" data-action="modal:action" data-modal="${id}" data-cmd="${a.cmd || ''}">${a.label}</button>`
  ).join('');

  backdrop.innerHTML = `
    <div class="modal">
      <div class="modal__header">
        <div class="modal__title" id="modal-title-${id}">${title}</div>
        <button class="modal__close btn btn--ghost btn--icon" data-action="modal:close" data-modal="${id}" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal__body">${body}</div>
      ${actions.length ? `<div class="modal__actions" style="display:flex;gap:8px;margin-top:20px;flex-wrap:wrap">${actionsHTML}</div>` : ''}
    </div>
  `;

  // Close on backdrop click
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) closeModal(id);
  });

  container.appendChild(backdrop);
  _stack.push({ id, el: backdrop });
  state.ui.modals.add(id);

  // Trigger open animation
  requestAnimationFrame(() => backdrop.classList.add('open'));

  return backdrop;
}

export function closeModal(id) {
  let backdrop;
  if (id) {
    const entry = _stack.find(s => s.id === id);
    backdrop = entry?.el;
  } else {
    backdrop = _stack[_stack.length - 1]?.el;
  }
  if (!backdrop) return;

  backdrop.classList.remove('open');
  backdrop.addEventListener('transitionend', () => {
    backdrop.remove();
    const i = _stack.findIndex(s => s.el === backdrop);
    if (i >= 0) { state.ui.modals.delete(_stack[i].id); _stack.splice(i, 1); }
  }, { once: true });
}

export function closeTopModal() {
  if (_stack.length) closeModal(_stack[_stack.length - 1].id);
}

export function closeAllModals() {
  [..._stack].reverse().forEach(s => closeModal(s.id));
}

/**
 * Simple confirm dialog.
 */
export function confirm(title, body) {
  return new Promise(resolve => {
    const id = 'confirm_' + Date.now();
    openModal({
      id,
      title,
      body: `<p style="color:var(--text-secondary)">${body}</p>`,
      actions: [
        { label: '✗ Abbrechen', class: 'btn--ghost', cmd: 'no' },
        { label: '✓ Bestätigen', class: 'btn--primary', cmd: 'yes' },
      ]
    });
    document.addEventListener('click', function handler(e) {
      const btn = e.target.closest(`[data-modal="${id}"][data-cmd]`);
      if (!btn) return;
      closeModal(id);
      document.removeEventListener('click', handler);
      resolve(btn.dataset.cmd === 'yes');
    });
  });
}
