import Link from "next/link";
import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { computeStatus } from "@/lib/creditLedger";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  LEAD: "Lead",
  ACTIVE: "Aktiv",
  PAUSED: "Pausiert",
  INACTIVE: "Inaktiv",
  ARCHIVED: "Archiviert",
};

const STATUS_BADGE: Record<string, string> = {
  LEAD: "bg-sky-100 text-sky-700",
  ACTIVE: "bg-brand-100 text-brand-700",
  PAUSED: "bg-amber-100 text-amber-700",
  INACTIVE: "bg-slate-200 text-slate-600",
  ARCHIVED: "bg-slate-100 text-slate-400",
};

// CoachAdmin briefing §3 KUNDENVERWALTUNG. Search + status/segment
// filters are implemented server-side via searchParams (no client JS
// needed for the core list — keeps this fast and simple, matching the
// rest of the admin area's server-rendered pattern). The briefing's
// example table has separate "Paket"/"Rest" columns; merged here into
// one "Kontingent" column (which package(s) + how much is redundant at
// this width — the customer detail page's "Kontingente" tab (P3) has
// the full per-package breakdown). Computed via one batched query below
// rather than N+1 calls to src/lib/creditLedger.ts's per-client helper.
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const statusFilter = sp.status ?? "";
  const segmentFilter = sp.segment ?? "";

  const provider = await getActiveProvider();
  const segments = await prisma.customerSegment.findMany({
    where: { providerId: provider.id },
    orderBy: [{ isSystemDefault: "desc" }, { name: "asc" }],
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts
  const where: any = { providerId: provider.id };
  if (statusFilter) where.status = statusFilter;
  if (segmentFilter) where.segmentMemberships = { some: { segmentId: segmentFilter } };
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { customerNumber: { contains: q, mode: "insensitive" } },
    ];
  }

  const clients = await prisma.client.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      segmentMemberships: { include: { segment: true } },
      trainingPlans: { select: { id: true }, take: 1 },
    },
    take: 200,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts
  const clientIds = clients.map((c: any) => c.id);
  const entitlements =
    clientIds.length > 0
      ? await prisma.packageEntitlement.findMany({
          where: { clientId: { in: clientIds }, active: true },
          include: { ledgerEntries: true },
        })
      : [];
  const creditsByClient = new Map<string, { available: number; unlimited: boolean }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts
  for (const ent of entitlements as any[]) {
    const status = computeStatus(ent, ent.ledgerEntries);
    if (!ent.unlimited && status.available <= 0) continue;
    const existing = creditsByClient.get(ent.clientId) ?? { available: 0, unlimited: false };
    existing.unlimited = existing.unlimited || ent.unlimited;
    existing.available = existing.unlimited ? Infinity : existing.available + status.available;
    creditsByClient.set(ent.clientId, existing);
  }

  return (
    <main className="flex-1 px-6 py-10 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-serif text-3xl font-bold text-ink-900">Kunden</h1>
        <Link href="/admin/customers/new" className="rounded-lg bg-ink-900 text-white px-4 py-2 text-sm font-semibold shrink-0">
          + Kunde
        </Link>
      </div>
      <p className="mt-1 text-sm text-ink-700/70">
        {clients.length} Kunde{clients.length !== 1 ? "n" : ""} gefunden.{" "}
        <Link href="/admin/customers/manage" className="underline hover:text-brand-700">
          Segmente &amp; Legacy-Programme verwalten
        </Link>
      </p>

      <form className="mt-6 flex flex-wrap gap-3" method="get">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Name, E-Mail, Telefon, Kundennummer…"
          className="flex-1 min-w-[220px] rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
        />
        <select name="status" defaultValue={statusFilter} className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm">
          <option value="">Alle Status</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select name="segment" defaultValue={segmentFilter} className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm">
          <option value="">Alle Segmente</option>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
          {segments.map((s: any) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-ink-900 text-white px-4 py-2 text-sm font-semibold">
          Filtern
        </button>
        {(q || statusFilter || segmentFilter) && (
          <Link href="/admin/customers" className="rounded-lg border border-ink-900/15 px-4 py-2 text-sm">
            Zurücksetzen
          </Link>
        )}
      </form>

      {clients.length === 0 ? (
        <p className="mt-10 text-sm text-ink-700/60">Keine Kunden gefunden.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-ink-900/10">
          <table className="w-full text-sm">
            <thead className="bg-ink-900/5 text-left text-xs uppercase tracking-wide text-ink-900/50">
              <tr>
                <th className="px-4 py-3">Kunde</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Segment</th>
                <th className="px-4 py-3">Kontingent</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Kundennummer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-900/5">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
              {clients.map((c: any) => (
                <tr key={c.id} className="hover:bg-ink-900/[0.03]">
                  <td className="px-4 py-3">
                    <Link href={`/admin/customers/${c.id}`} className="font-medium text-ink-900 hover:underline">
                      {c.firstName} {c.lastName}
                    </Link>
                    <p className="text-xs text-ink-700/50">{c.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[c.status] ?? ""}`}>
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
                      {c.segmentMemberships.map((m: any) => (
                        <span key={m.id} className="rounded-full bg-ink-900/5 px-2 py-0.5 text-[11px] text-ink-700">
                          {m.segment.name}
                        </span>
                      ))}
                      {c.segmentMemberships.length === 0 && <span className="text-xs text-ink-700/30">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-700/70">
                    {(() => {
                      const credit = creditsByClient.get(c.id);
                      if (!credit) return <span className="text-ink-700/30">—</span>;
                      return credit.unlimited ? "Unbegrenzt" : `${credit.available} verfügbar`;
                    })()}
                  </td>
                  <td className="px-4 py-3 text-ink-700/70">
                    {c.trainingPlans.length > 0 ? "vorhanden" : "kein Plan"}
                  </td>
                  <td className="px-4 py-3 text-ink-700/50">{c.customerNumber ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
