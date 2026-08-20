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

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const [
    clientCount,
    activeClientCount,
    scanCount,
    scansThisMonth,
    pendingScanCount,
    clientsWithoutPlan,
    appointmentsToday,
    unmatchedAppointments,
    scansWithoutPlan,
    scansWithUnpublishedPlan,
  ] = await Promise.all([
    prisma.client.count({ where: { providerId: provider.id } }),
    prisma.client.count({ where: { providerId: provider.id, status: "ACTIVE" } }),
    prisma.movementScan.count({ where: { providerId: provider.id } }),
    prisma.movementScan.count({ where: { providerId: provider.id, uploadedAt: { gte: startOfMonth } } }),
    prisma.movementScan.count({ where: { providerId: provider.id, status: "UPLOADED" } }),
    prisma.client.count({
      where: { providerId: provider.id, status: "ACTIVE", trainingPlans: { none: {} }, correctivePlans: { none: {} } },
    }),
    prisma.booking.count({
      where: {
        AND: [
          { OR: [{ client: { providerId: provider.id } }, { clientId: null }] },
          { startTime: { gte: todayStart, lt: todayEnd } },
        ],
      },
    }),
    // §21 — same "never silently drop" flag as /admin/appointments' own banner.
    prisma.booking.count({
      where: {
        AND: [
          { OR: [{ client: { providerId: provider.id } }, { clientId: null }] },
          { complimentary: false },
          { OR: [{ clientId: null }, { productId: null }] },
        ],
      },
    }),
    // §36 dashboard-level rollup of /admin/scans' "Braucht Aufmerksamkeit"
    // filter: scans with no CorrectivePlan yet, and scans whose plan(s)
    // are still awaiting review/publish. The two sets are disjoint (a
    // scan can't have zero plans AND a plan with status REVIEW_REQUIRED
    // at once), so they're summed below into one KPI.
    prisma.movementScan.count({ where: { providerId: provider.id, plans: { none: {} } } }),
    prisma.movementScan.count({ where: { providerId: provider.id, plans: { some: { status: "REVIEW_REQUIRED" } } } }),
  ]);
  const scansNeedingAttention = scansWithoutPlan + scansWithUnpublishedPlan;

  const links = [
    { href: "/admin/customers", label: "Kunden", description: "Kundenliste, Segmente, Zugang, Scan-Upload" },
    { href: "/admin/plans", label: "Trainingspläne", description: "Templates, Kundenpläne, Shop-Pläne, Plan Builder" },
    { href: "/admin/appointments", label: "Termine", description: "Calendly-Sync, Kontingent-Zuordnung, No-Show" },
    { href: "/admin/products", label: "Produkte", description: "Preise, Sonderpreise, Sichtbarkeit" },
    { href: "/admin/booking-links", label: "Buchungslinks", description: "Calendly-Links pro Produkt/Segment" },
    { href: "/admin/scans", label: "SmartMotionScan", description: "Alle Scans, Planstatus, Review & Veröffentlichen" },
    { href: "/admin/exercises", label: "Übungen", description: "Übungsbibliothek verwalten" },
    { href: "/admin/training", label: "Training", description: "Trainingseinheiten protokollieren" },
    { href: "/admin/progress", label: "Fortschritt", description: "Verlauf je Kunde" },
    { href: "/admin/customers/manage", label: "Segmente & Legacy", description: "Kundensegmente und Legacy-Programme verwalten" },
  ];

  return (
    <main className="flex-1 max-w-3xl mx-auto px-6 py-16">
      <h1 className="font-serif text-3xl font-bold text-ink-900">Hallo {admin?.name?.split(" ")[0] ?? "Coach"}!</h1>
      <p className="mt-2 text-ink-700/80">Coach-Bereich — hier siehst du nur Verwaltungsfunktionen, keine Kundenansicht.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-ink-900/10 bg-white/50 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Aktive Kunden</p>
          <p className="mt-2 font-serif text-3xl font-bold text-ink-900">{activeClientCount}</p>
          <p className="text-xs text-ink-700/50">von {clientCount} insgesamt</p>
        </div>
        <div className="rounded-xl border border-ink-900/10 bg-white/50 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Termine heute</p>
          <p className="mt-2 font-serif text-3xl font-bold text-ink-900">{appointmentsToday}</p>
          <Link href="/admin/appointments?range=today" className="text-xs text-ink-700/50 hover:underline">
            ansehen
          </Link>
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

      {(clientsWithoutPlan > 0 || pendingScanCount > 0 || unmatchedAppointments > 0 || scansNeedingAttention > 0) && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">Offene Aufgaben</p>
          <ul className="mt-2 text-sm text-amber-800 list-disc list-inside">
            {pendingScanCount > 0 && <li>{pendingScanCount} Scan(s) noch nicht ausgewertet</li>}
            {scansNeedingAttention > 0 && (
              <li>
                {scansNeedingAttention} Scan(s) brauchen noch einen Plan oder ein Review/Veröffentlichen —{" "}
                <Link href="/admin/scans?attention=1" className="font-semibold underline">
                  jetzt prüfen
                </Link>
              </li>
            )}
            {clientsWithoutPlan > 0 && <li>{clientsWithoutPlan} aktive Kunde(n) ohne Trainingsplan</li>}
            {unmatchedAppointments > 0 && (
              <li>
                {unmatchedAppointments} Termin(e) ohne Kunden-/Produkt-Zuordnung —{" "}
                <Link href="/admin/appointments?unmatched=1" className="font-semibold underline">
                  jetzt prüfen
                </Link>
              </li>
            )}
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
