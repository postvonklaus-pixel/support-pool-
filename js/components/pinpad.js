/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — PIN Pad Component
   ═══════════════════════════════════════════════════════ */

import { haptic } from '../utils.js';

const MAX_LEN = 6;

let _value   = '';
let _onChange = null;
let _onSubmit = null;

/** @param {{ onChange, onSubmit, maxLen? }} opts */
export function initPinPad({ onChange, onSubmit, maxLen = MAX_LEN } = {}) {
  _onChange = onChange;
  _onSubmit = onSubmit;

  const dots = document.getElementById('pin-dots');
  const disp = document.getElementById('pin-display');

  // Render dots
  if (dots) renderDots(dots, _value, maxLen);

  return { getValue: () => _value, reset: () => resetPin(maxLen) };
}

function renderDots(container, value, maxLen) {
  container.innerHTML = Array.from({ length: maxLen }, (_, i) =>
    `<span class="pin-dot ${i < value.length ? 'filled' : ''}"></span>`
  ).join('');
}

/** Called by events.js when data-action="pin:key" fires */
export function handlePinKey(el, maxLen = MAX_LEN) {
  const key = el.dataset.key;
  if (!key || _value.length >= maxLen) return;

  haptic('light');
  _value += key;

  const dots = document.getElementById('pin-dots');
  if (dots) renderDots(dots, _value, maxLen);

  if (_onChange) _onChange(_value);
  if (_value.length >= maxLen && _onSubmit) _onSubmit(_value);
}

/** Called by events.js when data-action="pin:del" fires */
export function handlePinDel(maxLen = MAX_LEN) {
  if (!_value.length) return;
  haptic('light');
  _value = _value.slice(0, -1);

  const dots = document.getElementById('pin-dots');
  if (dots) renderDots(dots, _value, maxLen);

  if (_onChange) _onChange(_value);
}

export function resetPin(maxLen = MAX_LEN) {
  _value = '';
  const dots = document.getElementById('pin-dots');
  if (dots) renderDots(dots, _value, maxLen);
}

/** Animate shake on error */
export function shakePin() {
  const dots = document.getElementById('pin-dots');
  if (!dots) return;
  dots.classList.remove('shake');
  void dots.offsetWidth;
  dots.classList.add('shake');
  haptic('error');
  setTimeout(() => dots.classList.remove('shake'), 500);
}
