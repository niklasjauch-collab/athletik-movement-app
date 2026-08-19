import { redirectIfClientLoggedIn } from "@/lib/auth";

// Coach-only manual scan-review tool (see page.tsx's own comments — this
// is the older flow, superseded for real use by /clients/[id]'s automatic
// upload pipeline, but kept for now). Not for end-customers, see
// src/lib/auth.ts#redirectIfClientLoggedIn.
export default async function ScansLayout({ children }: { children: React.ReactNode }) {
  await redirectIfClientLoggedIn();
  return <>{children}</>;
}
