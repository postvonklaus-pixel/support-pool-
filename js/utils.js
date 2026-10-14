/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Utilities
   ═══════════════════════════════════════════════════════ */

// ── DOM helpers ──────────────────────────────────────────
export const ge  = id => document.getElementById(id);
export const qs  = (sel, ctx = document) => ctx.querySelector(sel);
export const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

export function st(id, val) {
  const el = ge(id);
  if (el) el.textContent = val;
}

export function setHTML(id, html) {
  const el = ge(id);
  if (el) el.innerHTML = html;
}

// ── String helpers ───────────────────────────────────────
export function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function slugify(str) {
  return String(str).toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
}

export function capitalize(str) {
  return str ? str[0].toUpperCase() + str.slice(1) : '';
}

export function initials(name) {
  return (name || '?').slice(0, 2).toUpperCase();
}

// ── Time helpers ─────────────────────────────────────────
export function formatTime(ms) {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

export function timeAgo(ts, lang = 'de') {
  const diff = Date.now() - (ts || 0);
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return lang === 'de' ? 'gerade eben' : 'just now';
  if (mins < 60) return lang === 'de' ? `vor ${mins} Min` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return lang === 'de' ? `vor ${hrs} Std` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return lang === 'de' ? `vor ${days} Tagen` : `${days}d ago`;
}

export function fmtDate(ts) {
  return new Intl.DateTimeFormat(navigator.language, {
    day: 'numeric', month: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).format(new Date(ts));
}

// ── Clipboard ────────────────────────────────────────────
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch { return false; }
  }
}

// ── Haptic ───────────────────────────────────────────────
export function haptic(type = 'light') {
  if (!navigator.vibrate) return;
  const patterns = { light: [10], medium: [30], heavy: [60], success: [10, 50, 10] };
  navigator.vibrate(patterns[type] || patterns.light);
}

// ── Toast ────────────────────────────────────────────────
let _toastQueue = [];
let _toastTimer = null;

export function toast(msg, type = '', duration = 2800) {
  const container = ge('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ` toast--${type}` : '');
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('removing');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, duration);
}

// ── Ripple effect ─────────────────────────────────────────
export function addRipple(el, e) {
  const rect = el.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2;
  const x = (e.clientX - rect.left) - size / 2;
  const y = (e.clientY - rect.top)  - size / 2;
  const rpl = document.createElement('span');
  rpl.className = 'ripple';
  rpl.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
  el.appendChild(rpl);
  rpl.addEventListener('animationend', () => rpl.remove(), { once: true });
}

// ── Debounce / Throttle ───────────────────────────────────
export function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function throttle(fn, ms = 100) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last < ms) return;
    last = now; fn(...args);
  };
}

// ── Firebase key encoding ─────────────────────────────────
export function fbEnc(str) {
  if (!str) return '';
  return String(str)
    .replace(/\./g, '%2E')
    .replace(/\$/g, '%24')
    .replace(/#/g, '%23')
    .replace(/\[/g, '%5B')
    .replace(/\]/g, '%5D')
    .replace(/\//g, '%2F');
}

export function fbDec(key) {
  if (!key) return '';
  try { return decodeURIComponent(String(key)); } catch { return String(key); }
}

// ── Gradient avatar color ─────────────────────────────────
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)',
  'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
  'linear-gradient(135deg, #06b6d4 0%, #10b981 100%)',
  'linear-gradient(135deg, #f97316 0%, #f59e0b 100%)',
];
export function avatarGradient(name) {
  let hash = 0;
  for (const c of (name || '')) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

// ── Count-up animation ─────────────────────────────────────
export function countUp(el, from, to, duration = 600) {
  if (!el) return;
  const start = performance.now();
  const diff = to - from;
  function step(now) {
    const p = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(from + diff * p);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── Open URL (TikTok etc.) ────────────────────────────────
export function openUrl(url) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

// ── Safe JSON parse ───────────────────────────────────────
export function safeJSON(str, fallback = null) {
  try { return JSON.parse(str); } catch { return fallback; }
}

// ── Generate ID ───────────────────────────────────────────
export function uid(prefix = 'n') {
  return `${prefix}${Date.now()}_${(Math.random() * 99999 | 0)}`;
}
