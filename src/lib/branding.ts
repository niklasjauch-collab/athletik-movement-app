/**
 * Branding config — the core of the white-label setup.
 *
 * Athletik Movement is the platform's first beta tenant, so its identity
 * (name, logo, color) is the static default here for now. From Phase 4
 * onward, once a second tenant goes live, this should be replaced by a
 * lookup against the `Provider` table (by custom domain or subdomain,
 * matching `prisma/seed-data`'s "athletik-movement" Provider row) so each
 * tenant gets its own branding without any code changes — the mechanism
 * (this function's return shape, consumed by layout.tsx/manifest.ts) is
 * already tenant-agnostic; only the lookup itself is still hardcoded.
 */

export type Branding = {
  appName: string;
  tagline: string;
  logoUrl: string | null;
  /** Square icon/lockup mark, used where a compact brand mark (not the
   * full wordmark) fits better — e.g. a login screen header. */
  iconUrl: string | null;
  primaryColor: string;
  supportEmail: string;
};

// TODO (Phase 4): replace with `getProviderByDomain(hostname)` once a
// second tenant is live. For now this is the single active (beta) tenant.
export function getBranding(): Branding {
  return {
    appName: "Athletik Movement",
    tagline: "Messen. Einordnen. Gezielt trainieren.",
    logoUrl: "/brand/athletik-movement-logo.png",
    iconUrl: "/brand/athletik-movement-lockup.png",
    primaryColor: "#4f7a12",
    supportEmail: "hello@athletik-movement.de",
  };
}
