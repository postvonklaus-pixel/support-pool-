/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Trust Level
   ═══════════════════════════════════════════════════════ */

import { state } from '../state.js';

const LEVELS = [
  { min: 0,   icon: '🔰', label: 'Neu',               color: '#94a3b8' },
  { min: 10,  icon: '✅', label: 'Verlässlich',        color: '#22d3ee' },
  { min: 30,  icon: '⭐', label: 'Vertrauenswürdig',  color: '#7c3aed' },
  { min: 75,  icon: '💎', label: 'Experte',            color: '#f59e0b' },
];

// Returns { icon, label, color, score } for a member key
export function trustLevel(memberKey) {
  const u     = state.db.members?.[memberKey] || {};
  const given = u.stats?.given    || 0;
  const recv  = u.stats?.received || 0;
  const posts = u.postsTotal      || 0;
  const _jTs  = u.joinedAt || u.joined || 0;
  const days  = _jTs ? Math.floor((Date.now() - _jTs) / 86400000) : 0;
  const streak = _streak(u);

  const score = Math.floor(given * 1.0 + posts * 0.5 + Math.min(days, 60) * 0.2 + streak * 0.5);
  const level = [...LEVELS].reverse().find(l => score >= l.min) || LEVELS[0];

  return { ...level, score };
}

// Compact HTML badge for use in cards
export function trustBadge(memberKey) {
  const tl = trustLevel(memberKey);
  return `<span class="trust-badge" style="color:${tl.color}" title="${tl.label} (Score ${tl.score})">${tl.icon}</span>`;
}

function _streak(u) {
  const days = u.supportDays || u.activeDays || [];
  let streak = 0;
  const d = new Date();
  while (days.includes(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
