"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// CoachAdmin briefing §1 ADMIN NAVIGATION: a fixed set of top-level items
// (deliberately NOT one nav entry per minor feature — "Nicht für jede
// Kleinigkeit einen eigenen Menüpunkt erstellen"). Desktop: left sidebar.
// Mobile: this same list behind a hamburger toggle.
//
// Several routes below don't exist yet (Einstellungen/P9) — still listed
// (so the nav's shape matches the briefing's final picture and Niklas can
// see what's coming) but rendered disabled with a "bald" tag instead of
// being a dead 404 link. Termine (P4), Produkte+Buchungslinks (P2),
// Trainingspläne (P5), Zahlungen (P7), and Analytics (P8) are now enabled.
type NavItem = { href: string; label: string; enabled: boolean };

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", enabled: true },
  { href: "/admin/customers", label: "Kunden", enabled: true },
  { href: "/admin/scans", label: "SmartMotionScan", enabled: true },
  { href: "/admin/plans", label: "Trainingspläne", enabled: true },
  { href: "/admin/exercises", label: "Übungen", enabled: true },
  { href: "/admin/appointments", label: "Termine", enabled: true },
  { href: "/admin/products", label: "Produkte", enabled: true },
  { href: "/admin/booking-links", label: "Buchungslinks", enabled: true },
  { href: "/admin/payments", label: "Zahlungen", enabled: true },
  { href: "/admin/analytics", label: "Analytics", enabled: true },
  { href: "/admin/settings", label: "Einstellungen", enabled: false },
];

// §62 QUICK ACTIONS — a fixed global menu, not one dialog per action. Most
// items link to an existing entry point rather than inventing a new one:
// Zahlung/Kontingent/Scan are customer-scoped in this app's design (a
// customer must be picked first — /admin/payments' own doc comment
// already explains this for Zahlung), Plan already has its "Neuen Plan
// anlegen" form on /admin/plans (P5), and Termin deliberately has NO
// manual-creation path — bookings only ever come from real Calendly
// events (P4's explicit design decision, see the Runde 5 Teil 6 status
// notes) so "+ Termin" links to the list where an admin reviews/matches
// them instead of a fabricated create dialog. "+ Kunde" is the one
// genuinely new flow (/admin/customers/new) since no admin-side customer
// creation existed before P8.
const QUICK_ACTIONS: { href: string; label: string }[] = [
  { href: "/admin/customers/new", label: "+ Kunde" },
  { href: "/admin/appointments", label: "+ Termin" },
  { href: "/admin/payments", label: "+ Zahlung" },
  { href: "/admin/plans", label: "+ Plan" },
  { href: "/admin/scans", label: "+ Scan" },
  { href: "/admin/customers", label: "+ Kontingent" },
];

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href + "/"));
        if (!item.enabled) {
          return (
            <span
              key={item.href}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-ink-900/30 cursor-default"
              title="Kommt in einer späteren Ausbaustufe"
            >
              {item.label}
              <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-900/20">bald</span>
            </span>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors " +
              (active ? "bg-brand-600 text-white" : "text-ink-900/80 hover:bg-ink-900/5")
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

// §61 Global Search box — submits to /admin/search (see that page's doc
// comment for why a results page instead of a live dropdown).
function SearchBox() {
  return (
    <form action="/admin/search" method="get" className="px-3 pb-3">
      <input
        type="text"
        name="q"
        placeholder="Suche… (Kunde, Termin, Zahlung…)"
        className="w-full rounded-lg border border-ink-900/15 px-3 py-1.5 text-sm"
      />
    </form>
  );
}

// §62 Quick Actions — a small always-visible list rather than a dropdown,
// since the sidebar has room and this keeps every action one click away
// (no extra client-side menu state needed).
function QuickActions({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="px-3 pt-4">
      <p className="px-0 pb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-900/30">Schnellaktionen</p>
      <div className="flex flex-wrap gap-1">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.label}
            href={a.href}
            onClick={onNavigate}
            className="rounded-full bg-ink-900/5 px-2.5 py-1 text-xs font-medium text-ink-900/70 hover:bg-ink-900/10"
          >
            {a.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function AdminNav({ adminName }: { adminName?: string | null }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-56 md:flex-col md:shrink-0 border-r border-ink-900/10 bg-white/60 px-3 py-6">
        <Link href="/admin" className="px-3 pb-4 font-serif text-lg font-bold text-ink-900">
          Athletik Movement
        </Link>
        <SearchBox />
        <NavLinks pathname={pathname} />
        <QuickActions />
        <div className="mt-auto px-3 pt-6 text-xs text-ink-900/50">
          {adminName ? `Angemeldet als ${adminName}` : null}
        </div>
      </aside>

      {/* Mobile top bar + drawer — the root layout's <header> already shows
          branding + name/logout on every screen size, so this bar is just
          the nav toggle, not a second logo. */}
      <div className="md:hidden sticky top-0 z-30 flex items-center justify-end border-b border-ink-900/10 bg-white/90 px-4 py-2 backdrop-blur">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-lg border border-ink-900/15 px-3 py-1.5 text-sm font-medium text-ink-900"
          aria-label="Menü"
        >
          {mobileOpen ? "Schließen" : "Menü"}
        </button>
      </div>
      {mobileOpen && (
        <div className="md:hidden border-b border-ink-900/10 bg-white/95 px-3 py-3">
          <SearchBox />
          <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          <QuickActions onNavigate={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  );
}
