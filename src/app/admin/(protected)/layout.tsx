import { redirectIfNotAdmin, getCurrentAdmin } from "@/lib/adminAuth";
import AdminNav from "@/components/admin/AdminNav";

// The ONE guard for the entire /admin/* coach area (everything except
// the (auth) route group's login/forgot-password/reset-password pages,
// which must stay reachable by a NOT-yet-logged-in coach). A Next.js
// layout runs server-side before its children, including any "use
// client" page inside it, so this covers /admin/customers, /admin/scans,
// /admin/exercises, /admin/training, /admin/progress and /admin itself
// with a single check — no per-page guard to forget. Replaces the old,
// weaker per-route redirectIfClientLoggedIn() guards (see git history),
// which only blocked a logged-in CUSTOMER but left these routes open to
// anyone else, including anonymous visitors.
//
// CoachAdmin briefing §1: also renders the persistent admin nav shell
// (desktop sidebar / mobile drawer) around every protected admin page —
// added here, once, rather than per-page, for the same "one place to get
// it right" reason as the guard itself.
export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  await redirectIfNotAdmin();
  const admin = await getCurrentAdmin();
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AdminNav adminName={admin?.name} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
