/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Countdown Timer Component
   ═══════════════════════════════════════════════════════ */

import { formatTime } from '../utils.js';

const _timers = new Map();

/**
 * Start a countdown timer that updates a DOM element.
 * @param {string} id       - unique timer ID
 * @param {number} endTs    - unix timestamp (ms) when the timer ends
 * @param {object} opts
 *   - el {HTMLElement}     - element to update
 *   - onTick {fn}          - called with remaining ms
 *   - onEnd {fn}           - called when timer reaches 0
 */
export function startTimer(id, endTs, { el, onTick, onEnd } = {}) {
  stopTimer(id);

  const tick = () => {
    const remaining = endTs - Date.now();
    if (remaining <= 0) {
      if (el) el.textContent = '00:00:00';
      if (onEnd) onEnd();
      stopTimer(id);
      return;
    }
    if (el) el.textContent = formatTime(remaining);
    if (onTick) onTick(remaining);
  };

  tick();
  const handle = setInterval(tick, 1000);
  _timers.set(id, handle);
  return id;
}

export function stopTimer(id) {
  if (_timers.has(id)) {
    clearInterval(_timers.get(id));
    _timers.delete(id);
  }
}

export function stopAllTimers() {
  _timers.forEach((_, id) => stopTimer(id));
}

/** Progress ring helper — returns SVG path value */
export function ringProgress(el, value, max) {
  if (!el) return;
  const r = parseFloat(el.getAttribute('r') || 36);
  const circ = 2 * Math.PI * r;
  const dash  = circ - (value / max) * circ;
  el.style.strokeDashoffset = dash.toFixed(2);
  el.style.strokeDasharray  = circ.toFixed(2);
}
