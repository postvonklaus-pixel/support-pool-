/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Fairness-Meter (B3.2)
   Score 0-100 measuring how balanced the pool is
   ═══════════════════════════════════════════════════════ */

import { state } from '../state.js';

/**
 * Compute a pool-level fairness score (0-100).
 * Higher = more balanced. Based on:
 *   - Balance spread among members
 *   - Ratio of members with negative vs positive balance
 *   - Active participation rate
 */
export function fairnessScore() {
  const members = Object.values(state.db.members || {}).filter(m => m.status === 'active');
  if (!members.length) return { score: 0, label: '-', color: '#6b7280', breakdown: [] };

  const balances = members.map(m => {
    const g = m.stats?.given    || 0;
    const r = m.stats?.received || 0;
    return g - r;
  });

  const pos = balances.filter(b => b > 0).length;
  const neg = balances.filter(b => b < 0).length;
  const zero = balances.length - pos - neg;

  // avg balance and spread
  const avg  = balances.reduce((s, b) => s + b, 0) / balances.length;
  const maxSpread = 20;
  const spread = balances.reduce((s, b) => s + Math.abs(b - avg), 0) / balances.length;
  const spreadScore = Math.max(0, 100 - Math.round((spread / maxSpread) * 100));

  // participation rate (active in last 7 days)
  const today = new Date();
  const lastWeek = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    return d.toISOString().slice(0, 10);
  });
  const activeCount = members.filter(m =>
    (m.supportDays || m.activeDays || []).some(d => lastWeek.includes(d))
  ).length;
  const participationScore = Math.round((activeCount / members.length) * 100);

  // ratio balance: penalize heavy negatives
  const heavyNeg = balances.filter(b => b <= -5).length;
  const ratioScore = Math.max(0, 100 - Math.round((heavyNeg / members.length) * 200));

  const score = Math.round(spreadScore * 0.4 + participationScore * 0.35 + ratioScore * 0.25);

  const color  = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';
  const label  = score >= 70 ? 'Fair' : score >= 40 ? 'Unausgeglichen' : 'Kritisch';

  return {
    score,
    label,
    color,
    breakdown: [
      { key: 'Verteilung',     val: spreadScore,       icon: '⚖️' },
      { key: 'Aktivität',      val: participationScore, icon: '🔥' },
      { key: 'Balance-Ratio',  val: ratioScore,         icon: '📊' },
    ],
    stats: {
      members: members.length,
      active:  activeCount,
      pos, neg, zero,
    },
  };
}

/** Render the fairness meter HTML for the admin health tab */
export function renderFairnessMeter() {
  const f = fairnessScore();
  const arc = Math.round((f.score / 100) * 220);

  return `
    <div class="fairness-meter">
      <div class="fairness-meter__header">
        <div class="fairness-meter__title">⚖️ Fairness-Meter</div>
        <div class="fairness-meter__badge" style="background:${f.color}">${f.label}</div>
      </div>

      <div class="fairness-meter__gauge-wrap">
        <svg width="120" height="72" viewBox="0 0 120 72" aria-hidden="true">
          <path d="M10 70 A50 50 0 1 1 110 70" fill="none" stroke="var(--border-subtle)" stroke-width="10" stroke-linecap="round"/>
          <path d="M10 70 A50 50 0 1 1 110 70" fill="none" stroke="${f.color}" stroke-width="10"
            stroke-linecap="round"
            stroke-dasharray="${arc * 1.73} 173"
            stroke-dashoffset="0"/>
          <text x="60" y="65" text-anchor="middle" font-size="20" font-weight="800"
            fill="${f.color}" font-family="system-ui,sans-serif">${f.score}</text>
        </svg>
      </div>

      <div class="fairness-meter__bars">
        ${f.breakdown.map(b => `
          <div class="fairness-bar">
            <div class="fairness-bar__label">${b.icon} ${b.key}</div>
            <div class="fairness-bar__track">
              <div class="fairness-bar__fill" style="width:${b.val}%; background:${f.color}"></div>
            </div>
            <div class="fairness-bar__val">${b.val}</div>
          </div>
        `).join('')}
      </div>

      <div class="fairness-meter__stats">
        <span>👥 ${f.stats.members} Mitglieder</span>
        <span>🟢 ${f.stats.pos} positiv</span>
        <span>🔴 ${f.stats.neg} negativ</span>
        <span>🔥 ${f.stats.active} aktiv</span>
      </div>
    </div>
  `;
}
