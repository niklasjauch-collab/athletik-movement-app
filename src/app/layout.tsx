import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getBranding } from "@/lib/branding";
import { getCurrentClient } from "@/lib/auth";
import { getCurrentAdmin } from "@/lib/adminAuth";
import "./globals.css";

// Using the system font stack (set in globals.css) rather than next/font/google
// on purpose: it avoids a build-time dependency on fonts.googleapis.com being
// reachable, which keeps this scaffold buildable in network-restricted
// environments (like this one). Swap in a custom webfont later if desired.

const branding = getBranding();

export const metadata: Metadata = {
  title: branding.appName,
  description: branding.tagline,
  icons: {
    icon: "/brand/icon-32.png",
    apple: "/brand/icon-192.png",
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const branding = getBranding();
  // Three distinct header states, not a toggle — see each branch below.
  // Both getCurrentClient()/getCurrentAdmin() never throw (return null on
  // any failure), so this can't break page rendering even if auth or the
  // DB is misconfigured. A person could in principle be logged in as
  // both at once (different cookies) — the admin branch wins in that
  // edge case, since a coach is unlikely to also be shopping as their
  // own customer in the same browser session.
  const [client, admin] = await Promise.all([getCurrentClient(), getCurrentAdmin()]);

  return (
    <html lang="de" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-cream">
        <header className="border-b border-ink-900/10 px-6 py-4 flex flex-wrap items-center justify-between gap-4 bg-cream">
          <Link href={admin ? "/admin" : client ? "/app" : "/"} className="flex items-center gap-2">
            {branding.logoUrl ? (
              <Image src={branding.logoUrl} alt={branding.appName} width={168} height={44} priority className="h-9 w-auto" />
            ) : (
              <span className="font-serif font-bold text-ink-900">{branding.appName}</span>
            )}
          </Link>

          {admin ? (
            // COACH_ADMIN: the actual admin navigation (Kunden/Scans/
            // Übungen/etc.) now lives in the persistent sidebar rendered
            // by /admin/(protected)/layout.tsx (CoachAdmin briefing §1) —
            // this top bar just keeps name+logout reachable from every
            // admin page without duplicating the sidebar's links here too.
            <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-ink-700">
              <span className="text-ink-900">{admin.name}</span>
              <form action="/api/admin/auth/logout" method="POST">
                <button type="submit" className="text-ink-700/70 hover:text-ink-900">
                  Logout
                </button>
              </form>
            </nav>
          ) : client ? (
            // CUSTOMER, logged in: only ever their own booking/portal/shop.
            // Full mobile bottom-nav (Home/Training/Ergebnisse/Termine/Shop)
            // is a P1 follow-up — this top nav is the interim version.
            <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-ink-700">
              <Link href="/app" className="hover:text-brand-700">
                Home
              </Link>
              <Link href="/app/appointments" className="hover:text-brand-700">
                Termine
              </Link>
              <Link href="/app/shop" className="hover:text-brand-700">
                Shop
              </Link>
              <span className="h-4 w-px bg-ink-900/10" aria-hidden />
              <span className="text-ink-900">{client.firstName}</span>
              <form action="/api/auth/logout" method="POST">
                <button type="submit" className="text-ink-700/70 hover:text-ink-900">
                  Logout
                </button>
              </form>
            </nav>
          ) : (
            // Nobody logged in: radically minimal public shell (spec
            // section 2) — no marketing homepage, no coach tooling, no
            // exercise library exposed. Just how to get in, plus one
            // optional booking shortcut straight to the real Calendly
            // SmartMotionScan link (no separate public booking page).
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium text-ink-700">
              <a
                href="https://calendly.com/athletikmovement/smartmotionscan"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-brand-700"
              >
                SmartMotionScan buchen
              </a>
              <span className="h-4 w-px bg-ink-900/10" aria-hidden />
              <Link href="/login" className="hover:text-brand-700">
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-brand-600 text-white px-3 py-1.5 font-semibold hover:bg-brand-700"
              >
                Registrieren
              </Link>
            </nav>
          )}
        </header>
        {children}
      </body>
    </html>
  );
}
