/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Support-Lock Feature (B4.2)
   Disable support buttons when balance ≥ 3 and no open videos
   ═══════════════════════════════════════════════════════ */

import { state } from '../state.js';

const BAL_LOCK = 3;
const R1_NEED  = 10;
const R2_NEED  = 10;

/**
 * Returns true when the user should not be able to support others:
 * balance >= 3 AND they have no open (pending) video in the pool.
 */
export function isSupportLocked(cu) {
  if (!cu) return false;
  const u = state.db.members?.[cu];
  if (!u) return false;

  const given = u.stats?.given || 0;
  const recv  = u.stats?.received || 0;
  if ((given - recv) < BAL_LOCK) return false;

  const myKey = cu.toLowerCase();
  const hasOpen = Object.values(state.db.videos || {}).some(v => {
    if (v.status === 'done' || v.status === 'expired') return false;
    if ((v.ownerKey || v.owner || '').toLowerCase() !== myKey) return false;
    const rnd = v.round || 1;
    const r1  = (v.r1Supporters || []).length;
    if (rnd === 1 && r1 < (v.r1Need || R1_NEED)) return true;
    const r2 = (v.r2Supporters || []).length;
    if (rnd === 2 && r2 < R2_NEED) return true;
    return false;
  });

  return !hasOpen; // locked: high balance but no open video
}
