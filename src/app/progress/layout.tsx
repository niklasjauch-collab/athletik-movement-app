import { redirectIfClientLoggedIn } from "@/lib/auth";

// Coach-only: reads the same localStorage /training data across
// placeholder clients (see page.tsx) — not a real per-client view yet, so
// not shown to end-customers. See src/lib/auth.ts#redirectIfClientLoggedIn.
export default async function ProgressLayout({ children }: { children: React.ReactNode }) {
  await redirectIfClientLoggedIn();
  return <>{children}</>;
}
