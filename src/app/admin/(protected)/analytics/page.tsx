import Link from "next/link";
import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { getRevenueCents } from "@/lib/payments";

export const dynamic = "force-dynamic";

function euro(cents: number) {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function periodBounds(period: string) {
  const now = new Date();
  if (period === "quarter") {
    const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
    const from = new Date(now.getFullYear(), qStartMonth, 1);
    const to = new Date(now.getFullYear(), qStartMonth + 3, 1);
    return { from, to, label: "dieses Quartal" };
  }
  if (period === "year") {
    return { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear() + 1, 0, 1), label: "dieses Jahr" };
  }
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { from, to, label: "diesen Monat" };
}

// CoachAdmin briefing §50 ANALYTICS + §51 SEGMENT-ANALYSE. "Nur
// geschäftlich relevante Kennzahlen... Keine Analytics-Überladung" — one
// page, no drill-down sub-pages, everything computed from the same §66-
// SSOT sources the rest of the admin area already uses (getRevenueCents()
// from P7, computeStatus() indirectly via reviewQueue.ts is NOT needed
// here since Analytics doesn't surface individual entitlement balances).
//
// §51's explicit rule "Kostenlose Beta-/Freund-Zugänge nicht als Umsatz
// zählen" is already enforced by getRevenueCents() itself (only PAID/
// PARTIALLY_REFUNDED payments count — a GOODWILL/FREE payment is
// COMPLIMENTARY status and never included), so the segment breakdown
// below inherits that for free without extra filtering.
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const period = sp.period === "quarter" || sp.period === "year" ? sp.period : "month";
  const { from, to, label } = periodBounds(period);

  const provider = await getActiveProvider();
  const now = new Date();
  const monthBounds = periodBounds("month");
  const quarterBounds = periodBounds("quarter");
  const yearBounds = periodBounds("year");
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

  const [
    revenueMonth,
    revenueQuarter,
    revenueYear,
    periodPayments,
    newClients,
    activeClients,
    inactiveClients,
    bookingsCompleted,
    bookingsNoShow,
    bookingsCanceled,
    activeAppClientIds,
    sessionsInWindow,
    segments,
  ] = await Promise.all([
    getRevenueCents(provider.id, monthBounds.from, monthBounds.to),
    getRevenueCents(provider.id, quarterBounds.from, quarterBounds.to),
    getRevenueCents(provider.id, yearBounds.from, yearBounds.to),
    prisma.payment.findMany({
      where: { providerId: provider.id, paidAt: { gte: from, lt: to }, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } },
      include: { product: { select: { name: true, type: true } }, client: { select: { id: true, segmentMemberships: { select: { segment: { select: { id: true, name: true } } } } } } },
    }),
    prisma.client.count({ where: { providerId: provider.id, createdAt: { gte: from, lt: to } } }),
    prisma.client.count({ where: { providerId: provider.id, status: "ACTIVE" } }),
    prisma.client.count({ where: { providerId: provider.id, status: "INACTIVE" } }),
    prisma.booking.count({
      where: { client: { providerId: provider.id }, status: "COMPLETED", startTime: { gte: from, lt: to } },
    }),
    prisma.booking.count({
      where: { client: { providerId: provider.id }, status: "NO_SHOW", startTime: { gte: from, lt: to } },
    }),
    prisma.booking.count({
      where: { client: { providerId: provider.id }, status: "CANCELED", startTime: { gte: from, lt: to } },
    }),
    prisma.trainingSession.findMany({
      where: { providerId: provider.id, status: "COMPLETED", completedAt: { gte: thirtyDaysAgo } },
      select: { clientId: true },
    }),
    prisma.trainingSession.count({
      where: { providerId: provider.id, status: "COMPLETED", completedAt: { gte: thirtyDaysAgo } },
    }),
    prisma.customerSegment.findMany({ where: { providerId: provider.id }, orderBy: { name: "asc" } }),
  ]);

  /* eslint-disable @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */
  const productSales = new Map<string, { count: number; cents: number }>();
  for (const p of periodPayments as any[]) {
    const key = p.product?.name ?? "Ohne Produkt";
    const entry = productSales.get(key) ?? { count: 0, cents: 0 };
    entry.count += 1;
    entry.cents += p.amountCents;
    productSales.set(key, entry);
  }
  const productRows = Array.from(productSales.entries()).sort((a, b) => b[1].cents - a[1].cents);

  const segmentRevenue = new Map<string, { name: string; cents: number; count: number }>();
  for (const seg of segments as any[]) segmentRevenue.set(seg.id, { name: seg.name, cents: 0, count: 0 });
  for (const p of periodPayments as any[]) {
    for (const m of p.client?.segmentMemberships ?? []) {
      const s = segmentRevenue.get(m.segment.id);
      if (s) {
        s.cents += p.amountCents;
        s.count += 1;
      }
    }
  }
  const segmentRows = Array.from(segmentRevenue.values())
    .filter((s) => s.count > 0)
    .sort((a, b) => b.cents - a.cents);

  const activeAppClients = new Set((activeAppClientIds as any[]).map((s) => s.clientId)).size;
  const avgAdherence = activeAppClients > 0 ? (sessionsInWindow / activeAppClients).toFixed(1) : "0";
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const periodTabs: Array<{ key: string; label: string }> = [
    { key: "month", label: "Monat" },
    { key: "quarter", label: "Quartal" },
    { key: "year", label: "Jahr" },
  ];

  return (
    <main className="flex-1 px-6 py-10 max-w-4xl mx-auto">
      <p className="text-sm text-ink-700/50">
        <Link href="/admin" className="hover:underline">
          ← Dashboard
        </Link>
      </p>
      <h1 className="mt-2 font-serif text-3xl font-bold text-ink-900">Analytics</h1>
      <p className="mt-1 text-sm text-ink-700/70">Nur geschäftlich relevante Kennzahlen — kein Überblick über alles.</p>

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-brand-600">Umsatz</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-ink-900/10 bg-white/50 p-4">
            <p className="text-xs text-ink-700/50">Monat</p>
            <p className="mt-1 font-serif text-2xl font-bold text-ink-900">{euro(revenueMonth)}</p>
          </div>
          <div className="rounded-xl border border-ink-900/10 bg-white/50 p-4">
            <p className="text-xs text-ink-700/50">Quartal</p>
            <p className="mt-1 font-serif text-2xl font-bold text-ink-900">{euro(revenueQuarter)}</p>
          </div>
          <div className="rounded-xl border border-ink-900/10 bg-white/50 p-4">
            <p className="text-xs text-ink-700/50">Jahr</p>
            <p className="mt-1 font-serif text-2xl font-bold text-ink-900">{euro(revenueYear)}</p>
          </div>
        </div>
      </section>

      <div className="mt-10 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-ink-900/40">Zeitraum für die Abschnitte unten:</span>
        <div className="flex gap-1">
          {periodTabs.map((t) => (
            <Link
              key={t.key}
              href={`/admin/analytics?period=${t.key}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                period === t.key ? "bg-ink-900 text-white" : "bg-ink-900/5 text-ink-700/70 hover:bg-ink-900/10"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <span className="text-xs text-ink-700/40">({label})</span>
      </div>

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-brand-600">Produkte</h2>
        {productRows.length === 0 ? (
          <p className="mt-2 text-sm text-ink-700/50">Keine Verkäufe im gewählten Zeitraum.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-xl border border-ink-900/10">
            <table className="w-full text-sm">
              <thead className="bg-ink-900/5 text-left text-xs uppercase tracking-wide text-ink-900/50">
                <tr>
                  <th className="px-4 py-2">Produkt</th>
                  <th className="px-4 py-2">Verkäufe</th>
                  <th className="px-4 py-2">Umsatz</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-900/5">
                {productRows.map(([name, v]) => (
                  <tr key={name}>
                    <td className="px-4 py-2">{name}</td>
                    <td className="px-4 py-2 text-ink-700/70">{v.count}</td>
                    <td className="px-4 py-2 font-medium">{euro(v.cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-ink-900/10 bg-white/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Neue Kunden</p>
          <p className="mt-1 font-serif text-2xl font-bold text-ink-900">{newClients}</p>
          <p className="text-xs text-ink-700/50">{label}</p>
        </div>
        <div className="rounded-xl border border-ink-900/10 bg-white/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Aktive Kunden</p>
          <p className="mt-1 font-serif text-2xl font-bold text-ink-900">{activeClients}</p>
        </div>
        <div className="rounded-xl border border-ink-900/10 bg-white/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Inaktive Kunden</p>
          <p className="mt-1 font-serif text-2xl font-bold text-ink-900">{inactiveClients}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-brand-600">Coaching</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-ink-900/10 bg-white/50 p-4">
            <p className="text-xs text-ink-700/50">Durchgeführt</p>
            <p className="mt-1 font-serif text-2xl font-bold text-ink-900">{bookingsCompleted}</p>
          </div>
          <div className="rounded-xl border border-ink-900/10 bg-white/50 p-4">
            <p className="text-xs text-ink-700/50">No Shows</p>
            <p className="mt-1 font-serif text-2xl font-bold text-ink-900">{bookingsNoShow}</p>
          </div>
          <div className="rounded-xl border border-ink-900/10 bg-white/50 p-4">
            <p className="text-xs text-ink-700/50">Stornierungen</p>
            <p className="mt-1 font-serif text-2xl font-bold text-ink-900">{bookingsCanceled}</p>
          </div>
        </div>
        <p className="mt-1 text-xs text-ink-700/40">{label}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-brand-600">Training</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-ink-900/10 bg-white/50 p-4">
            <p className="text-xs text-ink-700/50">Aktive App-Kunden (30 Tage)</p>
            <p className="mt-1 font-serif text-2xl font-bold text-ink-900">{activeAppClients}</p>
          </div>
          <div className="rounded-xl border border-ink-900/10 bg-white/50 p-4">
            <p className="text-xs text-ink-700/50">⌀ Einheiten je aktivem Kunden (30 Tage)</p>
            <p className="mt-1 font-serif text-2xl font-bold text-ink-900">{avgAdherence}</p>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-brand-600">Segment-Analyse (§51)</h2>
        <p className="mt-1 text-xs text-ink-700/50">
          Kostenlose Beta-/Freund-Zugänge zählen nicht als Umsatz (bereits durch getRevenueCents ausgeschlossen).
        </p>
        {segmentRows.length === 0 ? (
          <p className="mt-2 text-sm text-ink-700/50">Keine Umsätze mit Segmentzuordnung im gewählten Zeitraum.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-xl border border-ink-900/10">
            <table className="w-full text-sm">
              <thead className="bg-ink-900/5 text-left text-xs uppercase tracking-wide text-ink-900/50">
                <tr>
                  <th className="px-4 py-2">Segment</th>
                  <th className="px-4 py-2">Zahlungen</th>
                  <th className="px-4 py-2">Umsatz</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-900/5">
                {segmentRows.map((s) => (
                  <tr key={s.name}>
                    <td className="px-4 py-2">{s.name}</td>
                    <td className="px-4 py-2 text-ink-700/70">{s.count}</td>
                    <td className="px-4 py-2 font-medium">{euro(s.cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
