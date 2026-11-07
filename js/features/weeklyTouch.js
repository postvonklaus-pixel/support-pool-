/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Saturday Weekly-Reset Re-Engagement
   ═══════════════════════════════════════════════════════ */

import { state }   from '../state.js';
import { writeDB } from '../firebase.js';
import { addNotif } from './notifications.js';

const WIB_OFFSET_MS = 7 * 3600000;

function _enabled() {
  return state.db?.settings?.features?.weeklyResetTouch !== false;
}

// Returns 'YYYY-MM-DD' of today in WIB if it is Saturday >= 10:00 WIB, else null.
function _saturdayDateWIB() {
  const nowWIB = new Date(Date.now() + WIB_OFFSET_MS);
  if (nowWIB.getUTCDay() !== 6)   return null; // not Saturday
  if (nowWIB.getUTCHours() < 10)  return null; // before 10:00 WIB
  return nowWIB.toISOString().slice(0, 10);
}

// Capsule: in-app only for now. Ticket 10 adds FCM push here.
export function fireWeeklyResetTouch(cu) {
  addNotif(cu, '🔄', null, 'weeklyTouch', { msgKey: 'notifWeeklyTouch' });
}

export function checkWeeklyTouch() {
  if (!_enabled()) return;
  const cu = state.currentUser;
  if (!cu) return;
  const satDate = _saturdayDateWIB();
  if (!satDate) return;
  const u = state.db.members?.[cu];
  if (!u) return;
  if (u.lastWeeklyTouch === satDate) return; // already fired this Saturday
  writeDB(`members/${cu}/lastWeeklyTouch`, satDate);
  fireWeeklyResetTouch(cu);
}
