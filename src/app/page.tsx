import Link from "next/link";
import { redirect } from "next/navigation";
import { getBranding } from "@/lib/branding";
import { getCurrentClient } from "@/lib/auth";
import { getCurrentAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// Radically simplified public landing (spec section 2): this app is not
// a replacement for athletik-movement.de, so no marketing homepage, no
// service list, no embedded booking widget here anymore (that content
// used to live here — see git history / project status doc "Runde 3" —
// and has been intentionally removed). An unauthenticated visitor gets
// exactly: the logo, a way to log in, a way to register, and one
// optional shortcut to book a SmartMotionScan directly on Calendly.
// Everything else (customer app, coach admin) requires login and lives
// behind /app or /admin.
export default async function HomePage() {
  // Already logged in? Skip straight to the right area rather than
  // showing the logged-out shell — a bookmarked/PWA "/" shouldn't dead-end
  // an already-authenticated coach or customer.
  const [client, admin] = await Promise.all([getCurrentClient(), getCurrentAdmin()]);
  if (admin) redirect("/admin");
  if (client) redirect("/app");

  const branding = getBranding();

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-24">
      <div className="max-w-sm w-full text-center">
        <h1 className="font-serif text-2xl font-bold text-ink-900">{branding.appName}</h1>
        <p className="mt-2 text-sm text-ink-700/70">{branding.tagline}</p>

        <div className="mt-10 flex flex-col gap-3">
          <Link
            href="/login"
            className="rounded-lg border border-ink-900/15 px-4 py-2.5 text-sm font-semibold text-ink-900 hover:border-ink-900/30"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-brand-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-brand-700"
          >
            Registrieren
          </Link>
        </div>

        <p className="mt-6 text-xs text-ink-700/50">
          <Link href="/forgot-password" className="underline">
            Passwort vergessen?
          </Link>
        </p>

        <p className="mt-10 text-sm">
          <a
            href="https://calendly.com/athletikmovement/smartmotionscan"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-700 underline"
          >
            SmartMotionScan buchen
          </a>
        </p>
      </div>
    </main>
  );
}
