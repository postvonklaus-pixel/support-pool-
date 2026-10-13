/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Empty State Component (Part M)
   ═══════════════════════════════════════════════════════ */

/**
 * emptyState(icon, title, sub, opts)
 * opts: { action?, actionLabel?, actionData?, size? }
 * Returns HTML string.
 */
export function emptyState(icon, title, sub = '', {
  action      = '',
  actionLabel = '',
  actionData  = '',
  size        = 'md',   // 'sm' | 'md' | 'lg'
} = {}) {
  const cls = `empty-state empty-state--${size}`;
  const btn = action && actionLabel
    ? `<button class="btn btn--primary btn--sm empty-state__btn"
         data-action="${action}" ${actionData}>${actionLabel}</button>`
    : '';
  return `
    <div class="${cls}" role="status" aria-label="${title}">
      <div class="empty-state__icon">${icon}</div>
      <div class="empty-state__title">${title}</div>
      ${sub ? `<div class="empty-state__sub">${sub}</div>` : ''}
      ${btn}
    </div>
  `;
}

/**
 * loadingState(text) — skeleton / spinner placeholder
 */
export function loadingState(text = 'Wird geladen…') {
  return `
    <div class="loading-state" role="status" aria-label="${text}">
      <div class="loading-state__spinner"></div>
      <div class="loading-state__text">${text}</div>
    </div>
  `;
}
