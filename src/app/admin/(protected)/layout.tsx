import { redirectIfNotAdmin } from "@/lib/adminAuth";

// The ONE guard for the entire /admin/* coach area (everything except
// the (auth) route group's login/forgot-password/reset-password pages,
// which must stay reachable by a NOT-yet-logged-in coach). A Next.js
// layout runs server-side before its children, including any "use
// client" page inside it, so this covers /admin/clients, /admin/scans,
// /admin/exercises, /admin/training, /admin/progress and /admin itself
// with a single check — no per-page guard to forget. Replaces the old,
// weaker per-route redirectIfClientLoggedIn() guards (see git history),
// which only blocked a logged-in CUSTOMER but left these routes open to
// anyone else, including anonymous visitors.
export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  await redirectIfNotAdmin();
  return <>{children}</>;
}
