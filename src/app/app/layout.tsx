import { redirect } from "next/navigation";
import { getCurrentClient } from "@/lib/auth";

// Guard for the whole customer app (/app, /app/shop, /app/appointments,
// /app/results, /app/training/*, ...) — a single check here covers every
// route in the tree, same pattern as src/app/admin/(protected)/layout.tsx
// for the coach side. Individual pages may still call getCurrentClient()
// themselves when they need the client object (not just the boolean
// "logged in or not") — that's fine, getCurrentClient() is cached per
// request via React's cache(), so it's not a second DB round-trip.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const client = await getCurrentClient();
  if (!client) redirect("/login?redirectTo=/app");
  return <>{children}</>;
}
