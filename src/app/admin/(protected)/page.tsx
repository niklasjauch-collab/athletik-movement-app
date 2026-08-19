import Link from "next/link";
import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { getCurrentAdmin } from "@/lib/adminAuth";

// Hits the database directly without calling cookies()/headers() itself
// in its render path (getCurrentAdmin does, via the layout guard, but
// that alone doesn't make Next treat THIS page as dynamic) — same
// force-dynamic note as /admin/clients etc.
export const dynamic = "force-dynamic";

// Minimal admin dashboard — the redirect target after coach login
// (spec: "COACH_ADMIN → /admin"). A fuller dashboard with real
// analytics (spec section 23's /admin/analytics) is a later phase; this
// is deliberately just enough to orient and jump to the real tools.
export default async function AdminDashboardPage() {
  const admin = await getCurrentAdmin();
  const provider = await getActiveProvider();

  const [clientCount, scanCount, pendingScanCount] = await Promise.all([
    prisma.client.count({ where: { providerId: provider.id } }),
    prisma.movementScan.count({ where: { providerId: provider.id } }),
    prisma.movementScan.count({ where: { providerId: provider.id, status: "UPLOADED" } }),
  ]);

  const links = [
    { href: "/admin/clients", label: "Kunden", description: "Kundenliste, Details, Scan-Upload" },
    { href: "/admin/scans", label: "SmartMotionScan", description: "Manuelle Scan-Auswertung (älterer Flow)" },
    { href: "/admin/exercises", label: "Übungen", description: "Übungsbibliothek verwalten" },
    { href: "/admin/training", label: "Training", description: "Trainingseinheiten protokollieren" },
    { href: "/admin/progress", label: "Fortschritt", description: "Verlauf je Kunde" },
  ];

  return (
    <main className="flex-1 max-w-3xl mx-auto px-6 py-16">
      <h1 className="font-serif text-3xl font-bold text-ink-900">Hallo {admin?.name?.split(" ")[0] ?? "Coach"}!</h1>
      <p className="mt-2 text-ink-700/80">Coach-Bereich — hier siehst du nur Verwaltungsfunktionen, keine Kundenansicht.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-ink-900/10 bg-white/50 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Kunden</p>
          <p className="mt-2 font-serif text-3xl font-bold text-ink-900">{clientCount}</p>
        </div>
        <div className="rounded-xl border border-ink-900/10 bg-white/50 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Scans gesamt</p>
          <p className="mt-2 font-serif text-3xl font-bold text-ink-900">{scanCount}</p>
        </div>
        <div className="rounded-xl border border-ink-900/10 bg-white/50 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Unbearbeitet</p>
          <p className="mt-2 font-serif text-3xl font-bold text-ink-900">{pendingScanCount}</p>
        </div>
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-xl border border-ink-900/10 bg-white/50 p-5 hover:border-brand-300"
          >
            <p className="font-semibold text-ink-900">{l.label}</p>
            <p className="mt-1 text-sm text-ink-700/70">{l.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
