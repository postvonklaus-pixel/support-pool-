/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Countdown Timer Utilities
   ═══════════════════════════════════════════════════════ */

export function renderTimeLeft(expiresAt) {
  const diff = Math.max(0, expiresAt - Date.now());
  if (diff === 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h}h ${m}m ${s}s`;
}

export function startCountdownTicker() {
  if (window._countdownTicker) return;
  window._countdownTicker = setInterval(() => {
    document.querySelectorAll('[data-expires]').forEach(el => {
      const expiresAt = parseInt(el.dataset.expires, 10);
      if (!expiresAt) return;
      const timeLeft = renderTimeLeft(expiresAt);
      if (timeLeft === null) {
        el.textContent = '(abgelaufen)';
        el.style.color = 'var(--text-tertiary)';
      } else {
        el.textContent = `(in ${timeLeft})`;
      }
    });
  }, 1000);
}
