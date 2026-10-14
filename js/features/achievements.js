/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Achievement Engine
   ═══════════════════════════════════════════════════════ */

import { state }   from '../state.js';
import { t }       from '../i18n.js';
import { writeDB } from '../firebase.js';
import { toast }   from '../components/toast.js';
import { confetti } from '../components/confetti.js';

const ACH_DEFS = [
  { id: 'first_support',  icon: '🎉', key: 'achFirst',    cond: u => (u.stats?.given || 0) >= 1 },
  { id: 'supports_5',     icon: '⭐', key: null,           title: '5 Supports',   cond: u => (u.stats?.given || 0) >= 5 },
  { id: 'supports_10',    icon: '🔥', key: null,           title: '10 Supports',  cond: u => (u.stats?.given || 0) >= 10 },
  { id: 'supports_25',    icon: '💪', key: null,           title: '25 Supports',  cond: u => (u.stats?.given || 0) >= 25 },
  { id: 'supports_50',    icon: '🏆', key: null,           title: '50 Supports',  cond: u => (u.stats?.given || 0) >= 50 },
  { id: 'supports_100',   icon: '👑', key: null,           title: '100 Supports', cond: u => (u.stats?.given || 0) >= 100 },
  { id: 'streak_3',       icon: '🔗', key: 'achStreak3',  cond: u => _streak(u) >= 3 },
  { id: 'streak_7',       icon: '🌟', key: 'achStreak7',  cond: u => _streak(u) >= 7 },
  { id: 'streak_30',      icon: '🌙', key: 'achStreak30', cond: u => _streak(u) >= 30 },
  { id: 'first_post',     icon: '🎬', key: 'achFirstVid', cond: u => (u.postsTotal || 0) >= 1 },
  { id: 'posts_5',        icon: '🎞️', key: null,           title: '5 Videos',     cond: u => (u.postsTotal || 0) >= 5 },
  { id: 'balance_10',     icon: '💰', key: 'achBal10',    cond: u => { const g = u.stats?.given||0; const r = u.stats?.received||0; return (g-r)>=10; }},
  { id: 'early_bird',     icon: '🌅', key: 'achEarlyBird',cond: () => new Date().getHours() < 8 },
  { id: 'night_owl',      icon: '🦉', key: 'achNightOwl', cond: () => new Date().getHours() >= 23 },
];

function _achievTitle(def) {
  return def.key ? t(def.key) : def.title;
}

export const ACHIEVEMENTS = ACH_DEFS;

export function checkAchievements(cu) {
  const u        = state.db.members?.[cu];
  if (!u) return;
  const unlocked = new Set(u.achievements || []);
  const newOnes  = [];

  for (const a of ACHIEVEMENTS) {
    if (unlocked.has(a.id)) continue;
    try {
      if (a.cond(u)) newOnes.push(a);
    } catch { /* skip */ }
  }

  if (!newOnes.length) return;

  const updated = [...unlocked, ...newOnes.map(a => a.id)];
  writeDB(`members/${cu}/achievements`, updated);

  newOnes.forEach((a, i) => {
    setTimeout(() => {
      toast(`${a.icon} Achievement: ${_achievTitle(a)}`, 'success', 4000);
      if (i === 0) confetti();
    }, i * 1200);
  });
}

export function renderAchievements(cu) {
  const u        = state.db.members?.[cu] || {};
  const unlocked = new Set(u.achievements || []);

  return `
    <div class="achievements-grid">
      ${ACHIEVEMENTS.map(a => {
        const done = unlocked.has(a.id);
        return `<div class="achievement-badge ${done ? 'achievement-badge--done' : ''}" title="${a.title}: ${a.desc}">
          <div class="achievement-badge__icon">${a.icon}</div>
          <div class="achievement-badge__title">${_achievTitle(a)}</div>
        </div>`;
      }).join('')}
    </div>
  `;
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
