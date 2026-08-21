import Link from "next/link";
import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { getCurrentAdmin } from "@/lib/adminAuth";
import { getRevenueCents } from "@/lib/payments";
import { getReviewQueueCounts } from "@/lib/reviewQueue";

// Hits the database directly without calling cookies()/headers() itself
// in its render path (getCurrentAdmin does, via the layout guard, but
// that alone doesn't make Next treat THIS page as dynamic) — same
// force-dynamic note as /admin/customers etc.
export const dynamic = "force-dynamic";

// CoachAdmin briefing §2 ADMIN DASHBOARD + §60 REVIEW QUEUE. As of P8
// (Runde 5 Teil 10) this is a much fuller implementation of §2 than
// before: Heute/Diese Woche/Aktive Kunden/Aktive Trainingspläne/
// SmartMotionScans/Umsatz KPIs, "Nächste Termine" (§2), "Letzte
// Kundenaktivität" (§2 — built from existing timestamped models rather
// than a dedicated activity-log table, since a real Admin-Audit-Log is
// §43/P9 work, not this phase's), and the full 7-category Review Queue
// (§60) merged into the "Offene Aufgaben" box together with two extra,
// pre-existing items (Kunden ohne Trainingsplan, unbearbeitete Scans)
// that the briefing's own §2 example list already named alongside the
// §60 categories.
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

  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [
    clientCount,
    activeClientCount,
    scanCount,
    scansThisMonth,
    pendingScanCount,
    clientsWithoutPlan,
    appointmentsToday,
    appointmentsThisWeek,
    activeTrainingPlans,
    scansWithUnpublishedPlan,
    reviewQueue,
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
    prisma.booking.count({
      where: {
        AND: [
          { OR: [{ client: { providerId: provider.id } }, { clientId: null }] },
          { startTime: { gte: weekStart, lt: weekEnd } },
        ],
      },
    }),
    prisma.trainingPlan.count({ where: { providerId: provider.id, status: "PUBLISHED" } }),
    // §36 dashboard-level rollup, unchanged from P6 — scans whose plan(s)
    // are still awaiting review/publish (disjoint from reviewQueue's own
    // scansWithoutPlan, a scan can't be in both at once).
    prisma.movementScan.count({ where: { providerId: provider.id, plans: { some: { status: "REVIEW_REQUIRED" } } } }),
    getReviewQueueCounts(provider.id),
  ]);
  const scansNeedingAttention = reviewQueue.scansWithoutPlan + scansWithUnpublishedPlan;

  // §2 "Umsatz" KPI — via src/lib/payments.ts's getRevenueCents() so
  // Analytics (P8) sums the exact same way (§66 single-source-of-truth).
  const nextMonth = new Date(startOfMonth);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const revenueThisMonthCents = await getRevenueCents(provider.id, startOfMonth, nextMonth);

  // §2 "Nächste Termine" — compact upcoming list.
  const upcomingBookings = await prisma.booking.findMany({
    where: {
      AND: [{ OR: [{ client: { providerId: provider.id } }, { clientId: null }] }, { startTime: { gte: new Date() } }, { status: "CONFIRMED" }],
    },
    include: { client: { select: { firstName: true, lastName: true } }, product: { select: { name: true } } },
    orderBy: { startTime: "asc" },
    take: 6,
  });

  // §2 "Letzte Kundenaktivität" — built from existing timestamped rows
  // (no dedicated activity feed table exists — that's §43 Admin-Audit-
  // Log/P9 territory), merged and sorted client-side into one feed.
  const [recentSessions, recentPayments, recentScans, recentSignups] = await Promise.all([
    prisma.trainingSession.findMany({
      where: { providerId: provider.id, status: "COMPLETED", completedAt: { not: null } },
      include: { client: { select: { firstName: true, lastName: true } } },
      orderBy: { completedAt: "desc" },
      take: 5,
    }),
    prisma.payment.findMany({
      where: { providerId: provider.id, status: { in: ["PAID", "PARTIALLY_REFUNDED", "COMPLIMENTARY"] } },
      include: { client: { select: { firstName: true, lastName: true } }, product: { select: { name: true } } },
      orderBy: { paidAt: "desc" },
      take: 5,
    }),
    prisma.movementScan.findMany({
      where: { providerId: provider.id },
      include: { client: { select: { firstName: true, lastName: true } } },
      orderBy: { uploadedAt: "desc" },
      take: 5,
    }),
    prisma.client.findMany({
      where: { providerId: provider.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  /* eslint-disable @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */
  const activity: { text: string; at: Date }[] = [
    ...recentSessions.map((s: any) => ({
      text: `${s.client.firstName} ${s.client.lastName} hat Training abgeschlossen.`,
      at: s.completedAt as Date,
    })),
    ...recentPayments.map((p: any) => ({
      text: `${p.client.firstName} ${p.client.lastName} hat ${p.product?.name ?? "eine Zahlung"} ${p.status === "COMPLIMENTARY" ? "erhalten" : "gekauft"}.`,
      at: p.paidAt as Date,
    })),
    ...recentScans.map((s: any) => ({
      text: `${s.client.firstName} ${s.client.lastName} hat einen SmartMotionScan hochgeladen.`,
      at: s.uploadedAt as Date,
    })),
    ...recentSignups.map((c: any) => ({
      text: `${c.firstName} ${c.lastName} ist als neuer Kunde registriert.`,
      at: c.createdAt as Date,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 6);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const links = [
    { href: "/admin/customers", label: "Kunden", description: "Kundenliste, Segmente, Zugang, Scan-Upload" },
    { href: "/admin/plans", label: "Trainingspläne", description: "Templates, Kundenpläne, Shop-Pläne, Plan Builder" },
    { href: "/admin/appointments", label: "Termine", description: "Calendly-Sync, Kontingent-Zuordnung, No-Show" },
    { href: "/admin/products", label: "Produkte", description: "Preise, Sonderpreise, Sichtbarkeit" },
    { href: "/admin/booking-links", label: "Buchungslinks", description: "Calendly-Links pro Produkt/Segment" },
    { href: "/admin/scans", label: "SmartMotionScan", description: "Alle Scans, Planstatus, Review & Veröffentlichen" },
    { href: "/admin/payments", label: "Zahlungen", description: "Zahlungsübersicht, manuelle Zahlungen, Refunds" },
    { href: "/admin/analytics", label: "Analytics", description: "Umsatz, Produkte, Kunden, Coaching, Training" },
    { href: "/admin/exercises", label: "Übungen", description: "Übungsbibliothek verwalten" },
    { href: "/admin/training", label: "Training", description: "Trainingseinheiten protokollieren" },
    { href: "/admin/progress", label: "Fortschritt", description: "Verlauf je Kunde" },
    { href: "/admin/customers/manage", label: "Segmente & Legacy", description: "Kundensegmente und Legacy-Programme verwalten" },
  ];

  const tasks: { text: string; href?: string }[] = [];
  if (pendingScanCount > 0) tasks.push({ text: `${pendingScanCount} Scan(s) noch nicht ausgewertet`, href: "/admin/scans" });
  if (scansNeedingAttention > 0) tasks.push({ text: `${scansNeedingAttention} Scan(s) brauchen noch einen Plan oder ein Review/Veröffentlichen`, href: "/admin/scans?attention=1" });
  if (clientsWithoutPlan > 0) tasks.push({ text: `${clientsWithoutPlan} aktive Kunde(n) ohne Trainingsplan` });
  if (reviewQueue.unmatchedBookings > 0) tasks.push({ text: `${reviewQueue.unmatchedBookings} Termin(e) ohne Kunden-/Produkt-Zuordnung`, href: "/admin/appointments?unmatched=1" });
  if (reviewQueue.unmatchedPayments > 0) tasks.push({ text: `${reviewQueue.unmatchedPayments} Zahlung(en) unklar (ausstehend/fehlgeschlagen/ohne Produkt)`, href: "/admin/payments" });
  if (reviewQueue.draftPlans > 0) tasks.push({ text: `${reviewQueue.draftPlans} Kunden-/Shop-Plan(pläne) noch im Entwurf`, href: "/admin/plans" });
  if (reviewQueue.exercisesMissingVideo > 0) tasks.push({ text: `${reviewQueue.exercisesMissingVideo} Übung(en) ohne Video`, href: "/admin/exercises?video=missing" });
  if (reviewQueue.customersWithoutAccess > 0) tasks.push({ text: `${reviewQueue.customersWithoutAccess} aktive Kunde(n) ohne Zugang (kein Kontingent, keine Freigabe)`, href: "/admin/customers" });
  if (reviewQueue.packageBalanceConflicts > 0) tasks.push({ text: `${reviewQueue.packageBalanceConflicts} Kontingent(e) mit negativem Saldo — bitte prüfen`, href: "/admin/customers" });

  return (
    <main className="flex-1 max-w-4xl mx-auto px-6 py-16">
      <h1 className="font-serif text-3xl font-bold text-ink-900">Hallo {admin?.name?.split(" ")[0] ?? "Coach"}!</h1>
      <p className="mt-2 text-ink-700/80">Coach-Bereich — hier siehst du nur Verwaltungsfunktionen, keine Kundenansicht.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-ink-900/10 bg-white/50 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Aktive Kunden</p>
          <p className="mt-2 font-serif text-2xl font-bold text-ink-900">{activeClientCount}</p>
          <p className="text-xs text-ink-700/50">von {clientCount} insgesamt</p>
        </div>
        <div className="rounded-xl border border-ink-900/10 bg-white/50 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Termine heute</p>
          <p className="mt-2 font-serif text-2xl font-bold text-ink-900">{appointmentsToday}</p>
          <Link href="/admin/appointments?range=today" className="text-xs text-ink-700/50 hover:underline">
            ansehen
          </Link>
        </div>
        <div className="rounded-xl border border-ink-900/10 bg-white/50 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Diese Woche</p>
          <p className="mt-2 font-serif text-2xl font-bold text-ink-900">{appointmentsThisWeek}</p>
          <p className="text-xs text-ink-700/50">Termine</p>
        </div>
        <div className="rounded-xl border border-ink-900/10 bg-white/50 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Aktive Pläne</p>
          <p className="mt-2 font-serif text-2xl font-bold text-ink-900">{activeTrainingPlans}</p>
          <p className="text-xs text-ink-700/50">veröffentlicht</p>
        </div>
        <div className="rounded-xl border border-ink-900/10 bg-white/50 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">SmartMotionScans</p>
          <p className="mt-2 font-serif text-2xl font-bold text-ink-900">{scansThisMonth}</p>
          <p className="text-xs text-ink-700/50">diesen Monat · {scanCount} gesamt</p>
        </div>
        <div className="rounded-xl border border-ink-900/10 bg-white/50 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Umsatz</p>
          <p className="mt-2 font-serif text-2xl font-bold text-ink-900">
            {(revenueThisMonthCents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
          </p>
          <Link href="/admin/analytics" className="text-xs text-ink-700/50 hover:underline">
            diesen Monat · Analytics
          </Link>
        </div>
      </div>

      {tasks.length > 0 && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">Offene Aufgaben (§60 Review Queue)</p>
          <ul className="mt-2 text-sm text-amber-800 list-disc list-inside">
            {tasks.map((t, i) => (
              <li key={i}>
                {t.href ? (
                  <Link href={t.href} className="font-semibold underline">
                    {t.text}
                  </Link>
                ) : (
                  t.text
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-900/40">Nächste Termine</p>
          {upcomingBookings.length === 0 ? (
            <p className="mt-2 text-sm text-ink-700/50">Keine anstehenden Termine.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
              {upcomingBookings.map((b: any) => (
                <li key={b.id}>
                  <Link href={`/admin/appointments/${b.id}`} className="block rounded-lg border border-ink-900/10 bg-white/50 px-3 py-2 text-sm hover:border-brand-300">
                    <span className="font-medium text-ink-900">
                      {b.client ? `${b.client.firstName} ${b.client.lastName}` : (b.inviteeName ?? "Unbekannt")}
                    </span>
                    <span className="text-ink-700/60">
                      {" "}
                      · {b.product?.name ?? b.calendlyEventName ?? "—"} ·{" "}
                      {b.startTime.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-900/40">Letzte Kundenaktivität</p>
          {activity.length === 0 ? (
            <p className="mt-2 text-sm text-ink-700/50">Noch keine Aktivität.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5">
              {activity.map((a, i) => (
                <li key={i} className="rounded-lg border border-ink-900/10 bg-white/50 px-3 py-2 text-sm">
                  <span className="text-ink-900">{a.text}</span>
                  <span className="ml-1 text-xs text-ink-700/40">{a.at.toLocaleDateString("de-DE")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
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
