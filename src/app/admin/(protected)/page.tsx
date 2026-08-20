import Link from "next/link";
import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { getCurrentAdmin } from "@/lib/adminAuth";

// Hits the database directly without calling cookies()/headers() itself
// in its render path (getCurrentAdmin does, via the layout guard, but
// that alone doesn't make Next treat THIS page as dynamic) — same
// force-dynamic note as /admin/customers etc.
export const dynamic = "force-dynamic";

// CoachAdmin briefing §2 ADMIN DASHBOARD — this is still a partial
// implementation of that section, not the full thing: real "Termine
// heute/diese Woche" and "Umsatz" KPIs need the Appointment (P4) and
// Payment (P7) models, and the "Offene Aufgaben"/Review-Queue widget
// needs several later phases' data (P3-P8) to compute from. What's
// wired up for real right now: Aktive Kunden, SmartMotionScans (total +
// this month), and a simple "Kunden ohne Trainingsplan" flag (one of the
// briefing's example Offene-Aufgaben items) computed from data that
// already exists. The rest of §2 is a later-phase follow-up, not
// skipped by oversight.
export default async function AdminDashboardPage() {
  const admin = await getCurrentAdmin();
  const provider = await getActiveProvider();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [clientCount, activeClientCount, scanCount, scansThisMonth, pendingScanCount, clientsWithoutPlan] =
    await Promise.all([
      prisma.client.count({ where: { providerId: provider.id } }),
      prisma.client.count({ where: { providerId: provider.id, status: "ACTIVE" } }),
      prisma.movementScan.count({ where: { providerId: provider.id } }),
      prisma.movementScan.count({ where: { providerId: provider.id, uploadedAt: { gte: startOfMonth } } }),
      prisma.movementScan.count({ where: { providerId: provider.id, status: "UPLOADED" } }),
      prisma.client.count({
        where: { providerId: provider.id, status: "ACTIVE", trainingPlans: { none: {} }, correctivePlans: { none: {} } },
      }),
    ]);

  const links = [
    { href: "/admin/customers", label: "Kunden", description: "Kundenliste, Segmente, Zugang, Scan-Upload" },
    { href: "/admin/scans", label: "SmartMotionScan", description: "Manuelle Scan-Auswertung (älterer Flow)" },
    { href: "/admin/exercises", label: "Übungen", description: "Übungsbibliothek verwalten" },
    { href: "/admin/training", label: "Training", description: "Trainingseinheiten protokollieren" },
    { href: "/admin/progress", label: "Fortschritt", description: "Verlauf je Kunde" },
    { href: "/admin/customers/manage", label: "Segmente & Legacy", description: "Kundensegmente und Legacy-Programme verwalten" },
  ];

  return (
    <main className="flex-1 max-w-3xl mx-auto px-6 py-16">
      <h1 className="font-serif text-3xl font-bold text-ink-900">Hallo {admin?.name?.split(" ")[0] ?? "Coach"}!</h1>
      <p className="mt-2 text-ink-700/80">Coach-Bereich — hier siehst du nur Verwaltungsfunktionen, keine Kundenansicht.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-ink-900/10 bg-white/50 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Aktive Kunden</p>
          <p className="mt-2 font-serif text-3xl font-bold text-ink-900">{activeClientCount}</p>
          <p className="text-xs text-ink-700/50">von {clientCount} insgesamt</p>
        </div>
        <div className="rounded-xl border border-ink-900/10 bg-white/50 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">SmartMotionScans</p>
          <p className="mt-2 font-serif text-3xl font-bold text-ink-900">{scansThisMonth}</p>
          <p className="text-xs text-ink-700/50">diesen Monat · {scanCount} gesamt</p>
        </div>
        <div className="rounded-xl border border-ink-900/10 bg-white/50 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Unbearbeitet</p>
          <p className="mt-2 font-serif text-3xl font-bold text-ink-900">{pendingScanCount}</p>
        </div>
      </div>

      {(clientsWithoutPlan > 0 || pendingScanCount > 0) && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">Offene Aufgaben</p>
          <ul className="mt-2 text-sm text-amber-800 list-disc list-inside">
            {pendingScanCount > 0 && <li>{pendingScanCount} Scan(s) noch nicht ausgewertet</li>}
            {clientsWithoutPlan > 0 && <li>{clientsWithoutPlan} aktive Kunde(n) ohne Trainingsplan</li>}
          </ul>
        </div>
      )}

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
