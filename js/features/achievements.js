/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Achievement Engine
   ═══════════════════════════════════════════════════════ */

import { state }   from '../state.js';
import { writeDB } from '../firebase.js';
import { toast }   from '../components/toast.js';
import { confetti } from '../components/confetti.js';

export const ACHIEVEMENTS = [
  { id: 'first_support',  icon: '🎉', title: 'Erster Support!',      desc: 'Dein erster Support im Pool',            cond: u => (u.stats?.given || 0) >= 1 },
  { id: 'supports_5',     icon: '⭐', title: '5 Supports',           desc: '5 Unterstützungen gegeben',              cond: u => (u.stats?.given || 0) >= 5 },
  { id: 'supports_10',    icon: '🔥', title: '10 Supports',          desc: 'Aktives Mitglied des Pools',             cond: u => (u.stats?.given || 0) >= 10 },
  { id: 'supports_25',    icon: '💪', title: '25 Supports',          desc: 'Ernsthafter Supporter',                  cond: u => (u.stats?.given || 0) >= 25 },
  { id: 'supports_50',    icon: '🏆', title: '50 Supports',          desc: 'Veteran des Support-Pools',              cond: u => (u.stats?.given || 0) >= 50 },
  { id: 'supports_100',   icon: '👑', title: '100 Supports',         desc: 'Legendärer Supporter',                   cond: u => (u.stats?.given || 0) >= 100 },
  { id: 'streak_3',       icon: '🔗', title: '3-Tage Streak',        desc: '3 Tage in Folge aktiv',                  cond: u => _streak(u) >= 3 },
  { id: 'streak_7',       icon: '🌟', title: '7-Tage Streak',        desc: 'Eine ganze Woche dabei!',                cond: u => _streak(u) >= 7 },
  { id: 'streak_30',      icon: '🌙', title: '30-Tage Streak',       desc: 'Ein Monat ununterbrochen',               cond: u => _streak(u) >= 30 },
  { id: 'first_post',     icon: '🎬', title: 'Erstes Video',         desc: 'Dein erstes Video im Pool',              cond: u => (u.postsTotal || 0) >= 1 },
  { id: 'posts_5',        icon: '🎞️', title: '5 Videos',             desc: '5 Videos erfolgreich supportet',         cond: u => (u.postsTotal || 0) >= 5 },
  { id: 'balance_10',     icon: '💰', title: 'Guthaben +10',         desc: 'Balance von +10 oder mehr erreicht',     cond: u => { const g = u.stats?.given||0; const r = u.stats?.received||0; return (g-r)>=10; }},
  { id: 'early_bird',     icon: '🌅', title: 'Frühaufsteher',        desc: 'Vor 8 Uhr supportet',                    cond: () => new Date().getHours() < 8 },
  { id: 'night_owl',      icon: '🦉', title: 'Nachteule',            desc: 'Nach 23 Uhr supportet',                  cond: () => new Date().getHours() >= 23 },
];

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
      toast(`${a.icon} Achievement: ${a.title}`, 'success', 4000);
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
          <div class="achievement-badge__title">${a.title}</div>
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
