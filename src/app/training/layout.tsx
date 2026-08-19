import { redirectIfClientLoggedIn } from "@/lib/auth";

// Coach-only session-logging demo tool (placeholder clients, localStorage
// data — see page.tsx). Clients don't build/log their own plans, see
// src/lib/auth.ts#redirectIfClientLoggedIn.
export default async function TrainingLayout({ children }: { children: React.ReactNode }) {
  await redirectIfClientLoggedIn();
  return <>{children}</>;
}
