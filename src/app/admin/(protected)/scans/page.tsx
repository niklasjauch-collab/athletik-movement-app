import Link from "next/link";
import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// CoachAdmin briefing §36 ÜBUNGSVERWALTUNG... nein, §36 SMARTMOTIONSCAN
// VERWALTUNG — a cross-customer list so the coach immediately sees which
// scans still need a finished + published plan, without opening every
// customer individually. Replaces the old client-side-only demo tool
// that used to live at this route (upload/analyze/build-a-plan against
// placeholder clients, nothing persisted) — that workflow is now for
// real, per-customer, at /admin/customers/[id]'s SmartMotionScan tab
// (backed by the real automatic scan-to-plan pipeline, see
// src/app/api/clients/[id]/scans/route.ts). This page is purely the
// coach's overview across all customers.
const SCAN_STATUS_LABELS: Record<string, string> = {
  UPLOADED: "Hochgeladen",
  FINDINGS_ENTERED: "Befunde erfasst",
  PLAN_GENERATED: "Plan generiert",
};

function planStatusOf(plans: { status: string }[]): { label: string; needsAttention: boolean } {
  if (plans.length === 0) return { label: "Kein Plan", needsAttention: true };
  const allPublished = plans.every((p) => p.status === "PUBLISHED");
  if (allPublished) return { label: "Veröffentlicht", needsAttention: false };
  const publishedCount = plans.filter((p) => p.status === "PUBLISHED").length;
  return {
    label: plans.length > 1 ? `Review erforderlich (${publishedCount}/${plans.length} veröffentlicht)` : "Review erforderlich",
    needsAttention: true,
  };
}

export default async function AdminScansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const needsAttentionOnly = sp.attention === "1";

  const provider = await getActiveProvider();

  const scans = await prisma.movementScan.findMany({
    where: { providerId: provider.id },
    orderBy: { uploadedAt: "desc" },
    include: {
      client: { select: { id: true, firstName: true, lastName: true, email: true } },
      plans: { select: { id: true, status: true } },
    },
    take: 300,
  });

  /* eslint-disable @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */
  const rows = scans
    .map((s: any) => ({ scan: s, planStatus: planStatusOf(s.plans) }))
    .filter(({ scan }: any) => {
      if (!q) return true;
      const name = `${scan.client.firstName} ${scan.client.lastName} ${scan.client.email}`.toLowerCase();
      return name.includes(q);
    })
    .filter(({ planStatus }: any) => !needsAttentionOnly || planStatus.needsAttention);
  /* eslint-enable @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */

  const attentionCount = scans
    .map((s: { plans: { status: string }[] }) => planStatusOf(s.plans))
    .filter((p: { needsAttention: boolean }) => p.needsAttention).length;

  const qs = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q: sp.q, attention: sp.attention, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const s = params.toString();
    return s ? `/admin/scans?${s}` : "/admin/scans";
  };

  return (
    <main className="flex-1 px-6 py-10 max-w-5xl mx-auto">
      <p className="text-sm text-ink-700/50">
        <Link href="/admin" className="hover:underline">
          ← Dashboard
        </Link>
      </p>
      <h1 className="mt-2 font-serif text-3xl font-bold text-ink-900">SmartMotionScan</h1>
      <p className="mt-1 text-sm text-ink-700/70">
        {rows.length} von {scans.length} Scan(s). {attentionCount} brauchen noch einen Plan oder ein Review.
      </p>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <Link
          href={qs({ attention: needsAttentionOnly ? "" : "1" })}
          className={`rounded-lg px-3 py-1.5 font-medium ${
            needsAttentionOnly ? "bg-amber-600 text-white" : "border border-amber-300 text-amber-700"
          }`}
        >
          Braucht Aufmerksamkeit
        </Link>
      </div>

      <form className="mt-4 flex flex-wrap gap-3" method="get">
        {needsAttentionOnly && <input type="hidden" name="attention" value="1" />}
        <input
          type="text"
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Kunde…"
          className="flex-1 min-w-[220px] rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-lg bg-ink-900 text-white px-4 py-2 text-sm font-semibold">
          Filtern
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="mt-10 text-sm text-ink-700/60">Kein Scan gefunden.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-ink-900/10">
          <table className="w-full text-sm">
            <thead className="bg-ink-900/5 text-left text-xs uppercase tracking-wide text-ink-900/50">
              <tr>
                <th className="px-4 py-3">Kunde</th>
                <th className="px-4 py-3">Datum</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Report</th>
                <th className="px-4 py-3">Planstatus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-900/5">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
              {rows.map(({ scan, planStatus }: any) => (
                <tr key={scan.id} className="hover:bg-ink-900/[0.03]">
                  <td className="px-4 py-3">
                    <Link href={`/admin/scans/${scan.id}`} className="font-medium text-ink-900 hover:underline">
                      {scan.client.firstName} {scan.client.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-700/60">{scan.uploadedAt.toLocaleDateString("de-DE")}</td>
                  <td className="px-4 py-3 text-ink-700/70">{SCAN_STATUS_LABELS[scan.status] ?? scan.status}</td>
                  <td className="px-4 py-3">
                    <a
                      href={`/api/scans/${scan.id}/download`}
                      className="text-brand-700 hover:underline"
                    >
                      {scan.fileName}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span className={planStatus.needsAttention ? "text-amber-700 font-medium" : "text-brand-600"}>
                      {planStatus.label}
                    </span>
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
