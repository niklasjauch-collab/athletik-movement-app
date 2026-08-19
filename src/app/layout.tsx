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
      <body className="min-h-full flex flex-col">
        <header className="border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            {branding.logoUrl ? (
              <Image src={branding.logoUrl} alt={branding.appName} width={168} height={44} priority className="h-9 w-auto" />
            ) : (
              <span className="font-bold">{branding.appName}</span>
            )}
          </Link>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
            <Link href="/">Book</Link>
            <Link href="/shop">Training plans</Link>
            <Link href="/exercises">Exercises</Link>
            <span className="h-4 w-px bg-slate-200" aria-hidden />
            <Link href="/clients">Kunden</Link>
            <Link href="/scans">SmartMotionScan</Link>
            <Link href="/training">Training</Link>
            <Link href="/progress">Fortschritt</Link>
            <span className="h-4 w-px bg-slate-200" aria-hidden />
            {client ? (
              <>
                <Link href="/portal" className="font-medium text-ink-900">
                  {client.firstName}
                </Link>
                <form action="/api/auth/logout" method="POST">
                  <button type="submit" className="text-slate-500 hover:text-ink-900">
                    Logout
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login">Login</Link>
                <Link
                  href="/register"
                  className="rounded-lg bg-brand-600 text-white px-3 py-1.5 font-medium hover:bg-brand-700"
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
