/**
 * Resolves the app's real public base URL (e.g.
 * "https://movura-app-production.up.railway.app") from an incoming
 * Request, for building absolute links (password-reset emails, etc.)
 * that get shown to / clicked by users outside the request itself.
 *
 * `request.url` is NOT safe for this: behind Railway's reverse proxy the
 * Next.js server sees the *internal* container URL (observed in
 * production as "http://localhost:8080/api/..."), not the public
 * https://...up.railway.app one — so `new URL(path, request.url)`
 * silently produces a localhost link that only works from inside the
 * container. See the 2026-08-20 report: the admin "Passwort setzen"
 * dev-mode link pointed at https://localhost:8080/admin/reset-password,
 * which nobody outside the container can open.
 *
 * Resolution order:
 *   1. Standard reverse-proxy forwarding headers (x-forwarded-proto /
 *      x-forwarded-host) — correct in any proxied deployment, Railway or
 *      otherwise, and reflects the exact host the browser used.
 *   2. RAILWAY_PUBLIC_DOMAIN (auto-set by Railway on every service) as a
 *      same-origin-independent fallback if headers are ever stripped.
 *   3. request.url itself, for local `next dev` (no proxy in front).
 */
export function resolveBaseUrl(request: Request): string {
  const headers = request.headers;

  const forwardedHost = headers.get("x-forwarded-host");
  if (forwardedHost) {
    const forwardedProto = headers.get("x-forwarded-proto") ?? "https";
    // x-forwarded-proto can be a comma-separated list (client,proxy1,...)
    // when there are multiple hops -- the first entry is the original.
    const proto = forwardedProto.split(",")[0].trim();
    return `${proto}://${forwardedHost}`;
  }

  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }

  return new URL(request.url).origin;
}

/** Joins resolveBaseUrl(request) with a path, e.g. "/admin/reset-password?token=...". */
export function absoluteUrl(request: Request, path: string): string {
  return new URL(path, resolveBaseUrl(request)).toString();
}
