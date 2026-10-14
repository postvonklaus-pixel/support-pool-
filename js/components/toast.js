/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Toast Notifications
   ═══════════════════════════════════════════════════════ */

let _container = null;

function getContainer() {
  if (!_container) {
    _container = document.createElement('div');
    _container.id = 'toast-container';
    _container.style.cssText = `
      position:fixed;bottom:calc(var(--nav-height,64px) + 16px);left:50%;
      transform:translateX(-50%);z-index:var(--z-toast,9000);
      display:flex;flex-direction:column;gap:8px;align-items:center;
      pointer-events:none;width:min(360px,90vw);
    `;
    document.body.appendChild(_container);
  }
  return _container;
}

const ICONS = {
  success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
  error:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  info:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
};

const COLORS = {
  success: 'var(--success)',
  error:   'var(--danger)',
  warning: '#f59e0b',
  info:    'var(--accent-primary)',
  '':      'var(--accent-primary)',
};

/**
 * Show a toast notification.
 * @param {string} msg
 * @param {string} type - 'success' | 'error' | 'warning' | 'info' | ''
 * @param {number} duration - ms
 */
export function toast(msg, type = '', duration = 2800) {
  const container = getContainer();
  const color = COLORS[type] || COLORS[''];
  const icon  = ICONS[type] || '';

  const el = document.createElement('div');
  el.style.cssText = `
    display:flex;align-items:center;gap:10px;padding:12px 18px;
    background:var(--bg-elevated);
    border:1px solid ${color}44;border-left:3px solid ${color};
    border-radius:12px;backdrop-filter:blur(16px);
    color:var(--text-primary);font-size:14px;line-height:1.4;
    box-shadow:var(--shadow-lg);pointer-events:auto;
    opacity:0;transform:translateY(12px) scale(0.95);
    transition:opacity 0.25s ease,transform 0.25s ease;
    max-width:100%;word-break:break-word;
  `;
  el.innerHTML = `
    ${icon ? `<span style="color:${color};flex-shrink:0">${icon}</span>` : ''}
    <span>${msg}</span>
  `;

  container.appendChild(el);

  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateY(0) scale(1)';
  });

  const dismiss = () => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px) scale(0.95)';
    el.addEventListener('transitionend', () => el.remove(), { once: true });
  };

  const timer = setTimeout(dismiss, duration);
  el.addEventListener('click', () => { clearTimeout(timer); dismiss(); });
}

export function toastSuccess(msg, dur) { toast(msg, 'success', dur); }
export function toastError(msg, dur)   { toast(msg, 'error',   dur); }
export function toastInfo(msg, dur)    { toast(msg, 'info',    dur); }
