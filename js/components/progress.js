/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Progress Visualization Components
   ═══════════════════════════════════════════════════════ */

const TAU = 2 * Math.PI;

// ── Progress Ring (SVG donut) ──────────────────────────────
// value/max → filled arc; label shown in center
export function progressRing(value, max, {
  label    = '',
  size     = 72,
  stroke   = 6,
  color    = 'var(--accent-primary)',
  trackCol = 'var(--bg-elevated)',
  id       = '',
} = {}) {
  const r   = (size - stroke) / 2;
  const circ = TAU * r;
  const pct  = max > 0 ? Math.min(1, value / max) : 0;
  const dash = pct * circ;
  const idAttr = id ? `id="${id}"` : '';

  return `
    <div class="prog-ring" style="width:${size}px;height:${size}px" ${idAttr}>
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
        <circle
          cx="${size / 2}" cy="${size / 2}" r="${r}"
          fill="none" stroke="${trackCol}" stroke-width="${stroke}"
        />
        <circle
          cx="${size / 2}" cy="${size / 2}" r="${r}"
          fill="none" stroke="${color}" stroke-width="${stroke}"
          stroke-linecap="round"
          stroke-dasharray="${dash} ${circ}"
          stroke-dashoffset="0"
          transform="rotate(-90 ${size / 2} ${size / 2})"
          class="prog-ring__arc"
        />
      </svg>
      <div class="prog-ring__center">
        <div class="prog-ring__val">${value}</div>
        ${label ? `<div class="prog-ring__label">${label}</div>` : ''}
      </div>
    </div>
  `;
}

// ── Circular Timer ─────────────────────────────────────────
// Shows countdown arc; call updateCircularTimer(id, msLeft, msTotal) to tick
export function circularTimer(msLeft, msTotal, { id = 'ctimer', size = 56, stroke = 5 } = {}) {
  const r    = (size - stroke) / 2;
  const circ = TAU * r;
  const pct  = msTotal > 0 ? Math.max(0, msLeft / msTotal) : 0;
  const dash = pct * circ;
  const hms  = _formatMs(msLeft);

  return `
    <div class="circ-timer" id="${id}" style="width:${size}px;height:${size}px"
         data-end="${Date.now() + msLeft}" data-total="${msTotal}" data-size="${size}" data-stroke="${stroke}">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
        <circle cx="${size/2}" cy="${size/2}" r="${r}"
          fill="none" stroke="var(--bg-elevated)" stroke-width="${stroke}"/>
        <circle class="circ-timer__arc" cx="${size/2}" cy="${size/2}" r="${r}"
          fill="none" stroke="var(--accent-warning)" stroke-width="${stroke}"
          stroke-linecap="round"
          stroke-dasharray="${dash} ${circ}"
          stroke-dashoffset="0"
          transform="rotate(-90 ${size/2} ${size/2})"/>
      </svg>
      <div class="circ-timer__text">${hms}</div>
    </div>
  `;
}

export function startCircularTimer(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const end   = +el.dataset.end;
  const total = +el.dataset.total;
  const size  = +el.dataset.size;
  const stroke= +el.dataset.stroke;
  const r     = (size - stroke) / 2;
  const circ  = TAU * r;
  const arc   = el.querySelector('.circ-timer__arc');
  const txt   = el.querySelector('.circ-timer__text');

  function tick() {
    const left = end - Date.now();
    if (left <= 0) { if (txt) txt.textContent = '00:00'; return; }
    const pct  = Math.max(0, left / total);
    if (arc) arc.setAttribute('stroke-dasharray', `${pct * circ} ${circ}`);
    if (txt) txt.textContent = _formatMs(left);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ── Streak Flames ──────────────────────────────────────────
// days: array of 'YYYY-MM-DD' strings; shows last 7 days
export function streakFlames(activeDays = [], { showLabels = true } = {}) {
  const today = new Date();
  const slots = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const key    = d.toISOString().slice(0, 10);
    const active = activeDays.includes(key);
    const label  = ['Mo','Di','Mi','Do','Fr','Sa','So'][d.getDay() === 0 ? 6 : d.getDay() - 1];
    return { key, active, label, isToday: i === 6 };
  });

  return `
    <div class="streak-flames" role="img" aria-label="7-Tage Streak">
      ${slots.map(s => `
        <div class="streak-flame${s.active ? ' streak-flame--active' : ''}${s.isToday ? ' streak-flame--today' : ''}">
          <div class="streak-flame__icon">🔥</div>
          ${showLabels ? `<div class="streak-flame__label">${s.label}</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

// ── Balance Meter ──────────────────────────────────────────
// balance: –cap to +cap; shows gradient bar with center zero line
export function balanceMeter(balance, cap = 20) {
  const pct     = Math.max(0, Math.min(100, ((balance + cap) / (cap * 2)) * 100));
  const cls     = balance > 0 ? 'positive' : balance < 0 ? 'negative' : 'neutral';
  const display = (balance > 0 ? '+' : '') + balance;

  return `
    <div class="bal-meter">
      <div class="bal-meter__val bal-meter__val--${cls}">${display}</div>
      <div class="bal-meter__track">
        <div class="bal-meter__fill bal-meter__fill--${cls}" style="width:${pct}%"></div>
        <div class="bal-meter__zero"></div>
      </div>
      <div class="bal-meter__labels">
        <span>−${cap}</span>
        <span>0</span>
        <span>+${cap}</span>
      </div>
    </div>
  `;
}

// ── Goal Pill ──────────────────────────────────────────────
// Compact inline indicator: "7 / 10 Supports"
export function goalPill(current, goal, label = '', { urgent = false } = {}) {
  const pct = goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0;
  const cls = urgent ? 'goal-pill--urgent' : pct >= 100 ? 'goal-pill--done' : '';

  return `
    <div class="goal-pill ${cls}">
      <div class="goal-pill__bar" style="width:${pct}%"></div>
      <span class="goal-pill__text">
        ${current}<span class="goal-pill__sep">/</span>${goal}${label ? ` ${label}` : ''}
      </span>
    </div>
  `;
}

// ── Internal helpers ───────────────────────────────────────
function _formatMs(ms) {
  if (ms <= 0) return '00:00';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${_p(h)}:${_p(m)}:${_p(s)}`;
  return `${_p(m)}:${_p(s)}`;
}

function _p(n) { return String(n).padStart(2, '0'); }
