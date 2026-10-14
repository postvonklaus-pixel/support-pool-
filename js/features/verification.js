/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Verification Feature
   Badge: blue checkmark for active power users
   ═══════════════════════════════════════════════════════ */

/**
 * Returns true if user qualifies for verified badge:
 * - postsTotal >= 50
 * - AND active on 5+ of last 7 days (weeklyActive >= 5)
 */
export function isVerified(u) {
  if (!u) return false;
  if ((u.postsTotal || 0) < 50) return false;
  if ((u.weeklyActive || 0) < 5) return false;
  return true;
}

/** SVG checkmark badge, inline */
export const VERIFIED_BADGE = `<span class="verified-badge" title="Verifiziert" aria-label="Verifiziert">
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="11" fill="#3b82f6"/>
    <polyline points="7 12 10.5 15.5 17 9" stroke="#fff" stroke-width="2.5"
      stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
</span>`;
