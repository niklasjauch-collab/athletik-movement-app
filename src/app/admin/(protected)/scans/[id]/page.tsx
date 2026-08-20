import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { COMPENSATION_RULES } from "@/lib/corrective/rules";
import { CorrectivePlanCard } from "@/components/CorrectivePlanCard";
import CorrectivePlanActions from "@/components/admin/CorrectivePlanActions";

export const dynamic = "force-dynamic";

const SCAN_STATUS_LABELS: Record<string, string> = {
  UPLOADED: "Hochgeladen",
  FINDINGS_ENTERED: "Befunde erfasst",
  PLAN_GENERATED: "Plan generiert",
};

const PLAN_STATUS_LABELS: Record<string, string> = {
  REVIEW_REQUIRED: "Review erforderlich",
  PUBLISHED: "Veröffentlicht",
};

// §36 detail view for one scan: findings, the report itself, and every
// CorrectivePlan generated from it with a Publish/Unpublish action each
// (§38's "Plan überprüfen -> veröffentlichen" step, made a first-class
// screen instead of only reachable from inside a customer's own page).
export default async function AdminScanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const provider = await getActiveProvider();

  const scan = await prisma.movementScan.findFirst({
    where: { id, providerId: provider.id },
    include: {
      client: { select: { id: true, firstName: true, lastName: true } },
      findings: true,
      plans: {
        orderBy: { priorityRank: "asc" },
        include: { items: { orderBy: { order: "asc" }, include: { exercise: true } } },
      },
    },
  });
  if (!scan) notFound();

  return (
    <main className="flex-1 px-6 py-10 max-w-4xl mx-auto pb-24">
      <p className="text-sm text-ink-700/50">
        <Link href="/admin/scans" className="hover:underline">
          ← SmartMotionScan
        </Link>
      </p>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink-900">{scan.fileName}</h1>
          <p className="mt-1 text-sm text-ink-700/70">
            <Link href={`/admin/customers/${scan.client.id}?tab=scan`} className="underline hover:text-brand-700">
              {scan.client.firstName} {scan.client.lastName}
            </Link>
            {" · "}
            {scan.uploadedAt.toLocaleDateString("de-DE")}
            {" · "}
            {SCAN_STATUS_LABELS[scan.status] ?? scan.status}
          </p>
        </div>
        <a
          href={`/api/scans/${scan.id}/download`}
          className="rounded-lg border border-ink-900/15 px-3 py-1.5 text-sm font-semibold text-ink-900 hover:bg-ink-900/5"
        >
          Report herunterladen
        </a>
      </div>

      {scan.findings.length > 0 && (
        <section className="mt-6 rounded-xl border border-ink-900/10 p-6">
          <h2 className="font-semibold">Erfasste Befunde</h2>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
            {scan.findings.map((f: any) => (
              <li key={f.id} className="text-xs rounded-full bg-ink-900/5 text-ink-700 px-2.5 py-1">
                {COMPENSATION_RULES[f.compensation as keyof typeof COMPENSATION_RULES]?.label ?? f.compensation}
                {f.side !== "BILATERAL" && ` (${f.side === "LEFT" ? "links" : "rechts"})`}
                {f.severity && ` · ${f.severity}`}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="font-semibold text-lg">Corrective-Exercise-Plan(e)</h2>
        {scan.plans.length === 0 ? (
          <p className="mt-3 text-sm text-ink-700/50">Noch kein Plan generiert.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-6">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
            {scan.plans.map((plan: any) => (
              <div key={plan.id} className="rounded-xl border border-ink-900/10 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      plan.status === "PUBLISHED" ? "bg-brand-100 text-brand-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {PLAN_STATUS_LABELS[plan.status] ?? plan.status}
                    {plan.publishedAt && plan.status === "PUBLISHED"
                      ? ` · seit ${new Date(plan.publishedAt).toLocaleDateString("de-DE")}`
                      : ""}
                  </span>
                  <CorrectivePlanActions planId={plan.id} status={plan.status} />
                </div>
                <div className="mt-4">
                  <CorrectivePlanCard plan={plan} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
