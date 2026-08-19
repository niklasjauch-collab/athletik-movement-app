import { redirectIfClientLoggedIn } from "@/lib/auth";

// Coach-only: the exercise library isn't shown to end-customers (see
// src/lib/auth.ts#redirectIfClientLoggedIn for why). Covers both
// /exercises and /exercises/drafts.
export default async function ExercisesLayout({ children }: { children: React.ReactNode }) {
  await redirectIfClientLoggedIn();
  return <>{children}</>;
}
