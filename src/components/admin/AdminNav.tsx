"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// CoachAdmin briefing §1 ADMIN NAVIGATION: a fixed set of top-level items
// (deliberately NOT one nav entry per minor feature — "Nicht für jede
// Kleinigkeit einen eigenen Menüpunkt erstellen"). Desktop: left sidebar.
// Mobile: this same list behind a hamburger toggle.
//
// Several routes below don't exist yet (Trainingspläne/P5, Termine/P4,
// Produkte+Buchungslinks/P2, Zahlungen/P7, Analytics/P8, Einstellungen/P9)
// — they're still listed (so the nav's shape matches the briefing's final
// picture and Niklas can see what's coming) but rendered disabled with a
// "bald" tag instead of being a dead 404 link.
type NavItem = { href: string; label: string; enabled: boolean };

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", enabled: true },
  { href: "/admin/customers", label: "Kunden", enabled: true },
  { href: "/admin/scans", label: "SmartMotionScan", enabled: true },
  { href: "/admin/plans", label: "Trainingspläne", enabled: false },
  { href: "/admin/exercises", label: "Übungen", enabled: true },
  { href: "/admin/appointments", label: "Termine", enabled: false },
  { href: "/admin/products", label: "Produkte", enabled: false },
  { href: "/admin/booking-links", label: "Buchungslinks", enabled: false },
  { href: "/admin/payments", label: "Zahlungen", enabled: false },
  { href: "/admin/analytics", label: "Analytics", enabled: false },
  { href: "/admin/settings", label: "Einstellungen", enabled: false },
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

export default function AdminNav({ adminName }: { adminName?: string | null }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-56 md:flex-col md:shrink-0 border-r border-ink-900/10 bg-white/60 px-3 py-6">
        <Link href="/admin" className="px-3 pb-6 font-serif text-lg font-bold text-ink-900">
          Athletik Movement
        </Link>
        <NavLinks pathname={pathname} />
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
          <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  );
}
