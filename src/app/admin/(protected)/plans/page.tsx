import Link from "next/link";
import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import CreatePlanForm from "./CreatePlanForm";

export const dynamic = "force-dynamic";

const KIND_LABELS: Record<string, string> = {
  TEMPLATE: "Template",
  INDIVIDUAL: "Kundenplan",
  SELLABLE: "Shop-Plan",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Entwurf",
  PUBLISHED: "Veröffentlicht",
  ARCHIVED: "Archiviert",
};

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  PUBLISHED: "bg-brand-100 text-brand-700",
  ARCHIVED: "bg-amber-100 text-amber-700",
};

const TABS = [
  { key: "templates", label: "Templates", kind: "TEMPLATE" },
  { key: "kundenplaene", label: "Kundenpläne", kind: "INDIVIDUAL" },
  { key: "shop", label: "Shop-Pläne", kind: "SELLABLE" },
  { key: "archiv", label: "Archiv", kind: null },
] as const;

// CoachAdmin briefing §32 TRAININGSPLAN-VERWALTUNG. Templates/Kundenpläne/
// Shop-Pläne/Archiv as tabs over one TrainingPlan table (see schema.prisma
// TrainingPlanKind/TrainingPlanStatus) rather than four separate routes —
// Archiv is a status filter that cuts across the other three kinds, not a
// fourth kind, so it's implemented as `status: "ARCHIVED"` regardless of
// which kind tab it's paired with.
export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const tabKey = TABS.some((t) => t.key === sp.tab) ? sp.tab! : "templates";
  const tab = TABS.find((t) => t.key === tabKey)!;

  const provider = await getActiveProvider();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts
  const where: any = { providerId: provider.id };
  if (tab.key === "archiv") {
    where.status = "ARCHIVED";
  } else {
    where.kind = tab.kind;
    where.status = { not: "ARCHIVED" };
  }
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { client: { firstName: { contains: q, mode: "insensitive" } } },
      { client: { lastName: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [plans, clients] = await Promise.all([
    prisma.trainingPlan.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: { client: { select: { id: true, firstName: true, lastName: true } }, _count: { select: { items: true } } },
    }),
    prisma.client.findMany({
      where: { providerId: provider.id },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
      take: 500,
    }),
  ]);

  const qs = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q, tab: tabKey, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const s = params.toString();
    return s ? `/admin/plans?${s}` : "/admin/plans";
  };

  return (
    <main className="flex-1 px-6 py-10 max-w-5xl mx-auto">
      <p className="text-sm text-ink-700/50">
        <Link href="/admin" className="hover:underline">
          ← Dashboard
        </Link>
      </p>
      <h1 className="mt-2 font-serif text-3xl font-bold text-ink-900">Trainingspläne</h1>
      <p className="mt-1 text-sm text-ink-700/70">
        {plans.length} Plan/Pläne · {tab.label}. Ein Template lässt sich per „Duplizieren“ direkt einem Kunden
        zuweisen (§35) — spätere Änderungen am Template verändern bereits zugewiesene Kundenpläne nie.
      </p>

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={qs({ tab: t.key })}
            className={`rounded-lg px-3 py-1.5 font-medium ${
              tabKey === t.key ? "bg-ink-900 text-white" : "border border-ink-900/15 text-ink-900"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <form className="mt-4 flex flex-wrap gap-3" method="get">
        <input type="hidden" name="tab" value={tabKey} />
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Titel, Kunde…"
          className="flex-1 min-w-[200px] rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-lg bg-ink-900 text-white px-4 py-2 text-sm font-semibold">
          Filtern
        </button>
      </form>

      {plans.length === 0 ? (
        <p className="mt-10 text-sm text-ink-700/60">Keine Pläne in dieser Ansicht.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-ink-900/10">
          <table className="w-full text-sm">
            <thead className="bg-ink-900/5 text-left text-xs uppercase tracking-wide text-ink-900/50">
              <tr>
                <th className="px-4 py-3">Titel</th>
                {tab.key === "archiv" && <th className="px-4 py-3">Art</th>}
                {tab.key === "kundenplaene" && <th className="px-4 py-3">Kunde</th>}
                <th className="px-4 py-3">Übungen</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Zuletzt geändert</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-900/5">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
              {plans.map((p: any) => (
                <tr key={p.id} className="hover:bg-ink-900/[0.03]">
                  <td className="px-4 py-3">
                    <Link href={`/admin/plans/${p.id}`} className="font-medium text-ink-900 hover:underline">
                      {p.title}
                    </Link>
                  </td>
                  {tab.key === "archiv" && <td className="px-4 py-3 text-ink-700/70">{KIND_LABELS[p.kind] ?? p.kind}</td>}
                  {tab.key === "kundenplaene" && (
                    <td className="px-4 py-3 text-ink-700/70">
                      {p.client ? `${p.client.firstName} ${p.client.lastName}` : "—"}
                    </td>
                  )}
                  <td className="px-4 py-3 text-ink-700/60">{p._count.items}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[p.status] ?? ""}`}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-700/50">
                    {p.updatedAt.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab.key !== "archiv" && (
        <section className="mt-10">
          <h2 className="font-semibold text-lg text-ink-900">Neuen Plan anlegen</h2>
          <div className="mt-3">
            <CreatePlanForm defaultKind={tab.kind ?? "TEMPLATE"} clients={clients} />
          </div>
        </section>
      )}
    </main>
  );
}
