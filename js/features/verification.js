/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Verification Feature
   Badge: blue checkmark for active power users
   ═══════════════════════════════════════════════════════ */

/** Returns true when user has posted 50+ videos total (verified badge). */
export function isVerified(u) {
  if (!u) return false;
  return (u.postsTotal || 0) >= 50;
}

/** SVG checkmark badge, inline */
export const VERIFIED_BADGE = `<span class="verified-badge" title="Verifiziert" aria-label="Verifiziert">
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="11" fill="#3b82f6"/>
    <polyline points="7 12 10.5 15.5 17 9" stroke="#fff" stroke-width="2.5"
      stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
</span>`;
