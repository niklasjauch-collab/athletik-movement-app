import Link from "next/link";
import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "Bestätigt",
  COMPLETED: "Durchgeführt",
  CANCELED: "Storniert",
  NO_SHOW: "No Show",
  RESCHEDULED: "Verschoben",
};

const STATUS_BADGE: Record<string, string> = {
  CONFIRMED: "bg-sky-100 text-sky-700",
  COMPLETED: "bg-brand-100 text-brand-700",
  CANCELED: "bg-slate-200 text-slate-600",
  NO_SHOW: "bg-amber-100 text-amber-700",
  RESCHEDULED: "bg-purple-100 text-purple-700",
};

const TYPE_LABELS: Record<string, string> = {
  COACHING_SESSION: "Einzelsession",
  COACHING_PACKAGE: "Paket",
  SMARTMOTION_SCAN: "SmartMotionScan",
  DIGITAL_TRAINING_PLAN: "Digitaler Trainingsplan",
  COMPLIMENTARY: "Kulanz / kostenlos",
};

function dayRange(offsetDays = 0) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + offsetDays);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function weekRange() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun..6=Sat
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const { start } = dayRange(mondayOffset);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

// CoachAdmin briefing §22 TERMINVERWALTUNG. A single filterable list
// rather than a literal Heute/Woche/Monat calendar grid — same pragmatic
// scoping call as elsewhere in this project when the full spec's UI
// ambition exceeds what a single pass can responsibly ship; the three
// date quick-filters below cover the "Heute"/"Woche" views' actual intent
// (fast triage) without building a calendar component. §21's "Nicht
// zugeordnete Termine" gets its own quick-filter + a standing count
// banner, since those are the appointments most likely to be missed.
export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const statusFilter = sp.status ?? "";
  const productFilter = sp.product ?? "";
  const segmentFilter = sp.segment ?? "";
  const range = sp.range ?? "all";
  const unmatchedOnly = sp.unmatched === "1";

  const provider = await getActiveProvider();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts
  const conditions: any[] = [{ OR: [{ client: { providerId: provider.id } }, { clientId: null }] }];
  if (statusFilter) conditions.push({ status: statusFilter });
  if (productFilter) conditions.push({ productId: productFilter });
  if (segmentFilter) conditions.push({ client: { segmentMemberships: { some: { segmentId: segmentFilter } } } });
  if (unmatchedOnly) {
    conditions.push({ complimentary: false });
    conditions.push({ OR: [{ clientId: null }, { productId: null }] });
  }
  if (q) {
    conditions.push({
      OR: [
        { client: { firstName: { contains: q, mode: "insensitive" } } },
        { client: { lastName: { contains: q, mode: "insensitive" } } },
        { client: { email: { contains: q, mode: "insensitive" } } },
        { inviteeName: { contains: q, mode: "insensitive" } },
        { inviteeEmail: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (range === "today") {
    const { start, end } = dayRange();
    conditions.push({ startTime: { gte: start, lt: end } });
  } else if (range === "week") {
    const { start, end } = weekRange();
    conditions.push({ startTime: { gte: start, lt: end } });
  }

  const [bookings, unmatchedCount, products, segments] = await Promise.all([
    prisma.booking.findMany({
      where: { AND: conditions },
      orderBy: { startTime: "desc" },
      take: 200,
      include: { client: true, product: { select: { id: true, name: true, type: true } } },
    }),
    prisma.booking.count({
      where: {
        AND: [
          { OR: [{ client: { providerId: provider.id } }, { clientId: null }] },
          { complimentary: false },
          { OR: [{ clientId: null }, { productId: null }] },
        ],
      },
    }),
    prisma.product.findMany({ where: { providerId: provider.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.customerSegment.findMany({ where: { providerId: provider.id }, orderBy: [{ isSystemDefault: "desc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);

  const qs = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q, status: statusFilter, product: productFilter, segment: segmentFilter, range, unmatched: unmatchedOnly ? "1" : "", ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const s = params.toString();
    return s ? `/admin/appointments?${s}` : "/admin/appointments";
  };

  return (
    <main className="flex-1 px-6 py-10 max-w-5xl mx-auto">
      <h1 className="font-serif text-3xl font-bold text-ink-900">Termine</h1>
      <p className="mt-1 text-sm text-ink-700/70">
        {bookings.length} Termin(e){range !== "all" ? ` · ${range === "today" ? "Heute" : "Diese Woche"}` : ""} —
        automatisch synchronisiert aus Calendly (§20). Buchungen ohne Kunden-/Produkt-Match landen in{" "}
        <Link href={qs({ unmatched: "1" })} className="underline hover:text-brand-700">
          Nicht zugeordnete Termine
        </Link>
        .
      </p>

      {unmatchedCount > 0 && !unmatchedOnly && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {unmatchedCount} Termin(e) ohne Kunden- oder Produkt-Zuordnung.{" "}
          <Link href={qs({ unmatched: "1" })} className="font-semibold underline">
            Jetzt prüfen
          </Link>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        <Link href={qs({ range: "all" })} className={`rounded-lg px-3 py-1.5 font-medium ${range === "all" ? "bg-ink-900 text-white" : "border border-ink-900/15 text-ink-900"}`}>
          Alle
        </Link>
        <Link href={qs({ range: "today" })} className={`rounded-lg px-3 py-1.5 font-medium ${range === "today" ? "bg-ink-900 text-white" : "border border-ink-900/15 text-ink-900"}`}>
          Heute
        </Link>
        <Link href={qs({ range: "week" })} className={`rounded-lg px-3 py-1.5 font-medium ${range === "week" ? "bg-ink-900 text-white" : "border border-ink-900/15 text-ink-900"}`}>
          Diese Woche
        </Link>
        <Link
          href={qs({ unmatched: unmatchedOnly ? "" : "1" })}
          className={`rounded-lg px-3 py-1.5 font-medium ${unmatchedOnly ? "bg-amber-600 text-white" : "border border-amber-300 text-amber-700"}`}
        >
          Nicht zugeordnet
        </Link>
      </div>

      <form className="mt-4 flex flex-wrap gap-3" method="get">
        {unmatchedOnly && <input type="hidden" name="unmatched" value="1" />}
        {range !== "all" && <input type="hidden" name="range" value={range} />}
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Kunde, E-Mail…"
          className="flex-1 min-w-[200px] rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
        />
        <select name="status" defaultValue={statusFilter} className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm">
          <option value="">Alle Status</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select name="product" defaultValue={productFilter} className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm">
          <option value="">Alle Produkte</option>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
          {products.map((p: any) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select name="segment" defaultValue={segmentFilter} className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm">
          <option value="">Alle Segmente</option>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
          {segments.map((s: any) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-ink-900 text-white px-4 py-2 text-sm font-semibold">
          Filtern
        </button>
      </form>

      {bookings.length === 0 ? (
        <p className="mt-10 text-sm text-ink-700/60">Keine Termine gefunden.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-ink-900/10">
          <table className="w-full text-sm">
            <thead className="bg-ink-900/5 text-left text-xs uppercase tracking-wide text-ink-900/50">
              <tr>
                <th className="px-4 py-3">Datum</th>
                <th className="px-4 py-3">Kunde</th>
                <th className="px-4 py-3">Produkt</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Kontingent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-900/5">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
              {bookings.map((b: any) => (
                <tr key={b.id} className="hover:bg-ink-900/[0.03]">
                  <td className="px-4 py-3">
                    <Link href={`/admin/appointments/${b.id}`} className="font-medium text-ink-900 hover:underline">
                      {b.startTime.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {b.client ? (
                      <>
                        {b.client.firstName} {b.client.lastName}
                      </>
                    ) : (
                      <span className="text-amber-700">{b.inviteeName ?? b.inviteeEmail ?? "Unbekannt"} · kein Kunde</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-700/70">
                    {b.product ? (TYPE_LABELS[b.product.type] ? `${b.product.name}` : b.product.name) : (
                      <span className="text-amber-700">{b.calendlyEventName ?? "kein Produkt"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[b.status] ?? ""}`}>
                      {STATUS_LABELS[b.status] ?? b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-700/60">
                    {b.complimentary ? "kostenlos" : b.entitlementId ? "reserviert" : b.productId ? "kein Kontingent" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
