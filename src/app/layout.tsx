import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getBranding } from "@/lib/branding";
import { getCurrentClient } from "@/lib/auth";
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
  // Reads the session cookie on every request so the header can show
  // "Portal / Logout" vs. "Login / Registrieren" without a client-side
  // flash. See src/lib/auth.ts — getCurrentClient() returns null (never
  // throws) when there's no session or the DB isn't reachable, so this
  // can't break page rendering even if auth is misconfigured.
  const client = await getCurrentClient();

  return (
    <html lang="de" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-cream">
        <header className="border-b border-ink-900/10 px-6 py-4 flex flex-wrap items-center justify-between gap-4 bg-cream">
          <Link href={client ? "/portal" : "/"} className="flex items-center gap-2">
            {branding.logoUrl ? (
              <Image src={branding.logoUrl} alt={branding.appName} width={168} height={44} priority className="h-9 w-auto" />
            ) : (
              <span className="font-serif font-bold text-ink-900">{branding.appName}</span>
            )}
          </Link>
          {/* Two distinct nav sets, not a toggle: a logged-in client only ever
              sees their own booking/portal/shop — coach tooling (Kunden,
              SmartMotionScan, Exercises, the /training + /progress demo
              logging tools) is a separate, deliberately smaller set of
              links. There's no coach login yet (single-operator beta, see
              project status doc), so those coach links stay reachable to
              anyone who isn't logged in as a client; the routes themselves
              also redirect a logged-in client away (see each page). */}
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-ink-700">
            {client ? (
              <>
                <Link href="/" className="hover:text-brand-700">
                  Termin buchen
                </Link>
                <Link href="/portal" className="hover:text-brand-700">
                  Mein Portal
                </Link>
                <Link href="/shop" className="hover:text-brand-700">
                  Trainingspläne
                </Link>
                <span className="h-4 w-px bg-ink-900/10" aria-hidden />
                <span className="text-ink-900">{client.firstName}</span>
                <form action="/api/auth/logout" method="POST">
                  <button type="submit" className="text-ink-700/70 hover:text-ink-900">
                    Logout
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/" className="hover:text-brand-700">
                  Buchen
                </Link>
                <Link href="/shop" className="hover:text-brand-700">
                  Trainingspläne
                </Link>
                <Link href="/exercises" className="hover:text-brand-700">
                  Übungen
                </Link>
                <span className="h-4 w-px bg-ink-900/10" aria-hidden />
                <Link href="/clients" className="hover:text-brand-700">
                  Kunden
                </Link>
                <Link href="/scans" className="hover:text-brand-700">
                  SmartMotionScan
                </Link>
                <Link href="/training" className="hover:text-brand-700">
                  Training
                </Link>
                <Link href="/progress" className="hover:text-brand-700">
                  Fortschritt
                </Link>
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
              </>
            )}
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
