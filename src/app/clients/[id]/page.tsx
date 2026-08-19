import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { CorrectivePlanCard } from "@/components/CorrectivePlanCard";
import UploadForm from "./UploadForm";

// Hits the database directly and doesn't itself call cookies()/headers(),
// so Next's automatic dynamic-API detection won't defer it — without this,
// `next build` tries to prerender it statically, which fails hard (not a
// graceful dynamic fallback) if the database isn't reachable from the
// build environment. See same note on ../page.tsx.
export const dynamic = "force-dynamic";

const COMPENSATION_LABELS: Record<string, string> = {
  FEET_TURN_OUT: "Füße drehen nach außen",
  FEET_FLATTEN: "Füße flachen ab",
  KNEES_MOVE_INWARD: "Knie bewegen sich nach innen",
  KNEES_MOVE_OUTWARD: "Knie bewegen sich nach außen",
  EXCESSIVE_FORWARD_LEAN: "Übermäßige Vorlage des Oberkörpers",
  LOW_BACK_ARCHES: "Unterer Rücken hohlt",
  LOW_BACK_ROUNDS: "Unterer Rücken rundet",
  ARMS_FALL_FORWARD: "Arme fallen nach vorne",
  SHOULDER_ELEVATION: "Schulterhochzug",
  SCAPULAR_WINGING: "Scapula-Winging",
  FORWARD_HEAD: "Vorgeschobener Kopf",
  ASYMMETRIC_SHIFT_CERVICAL: "Asymmetrische Halswirbelverschiebung",
  ASYMMETRIC_WEIGHT_SHIFT: "Asymmetrische Gewichtsverlagerung",
  HEELS_RISE: "Fersen heben ab",
};

// Coach-facing client detail: upload a scan (automatic pipeline, see
// UploadForm + src/app/api/clients/[id]/scans/route.ts), and review the
// resulting findings/plan history. This is the real, DB-backed
// counterpart to the /scans demo page — everything here is persisted via
// Prisma against a real registered client, not kept in browser state.
export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const provider = await getActiveProvider();

  const client = await prisma.client.findFirst({
    where: { id, providerId: provider.id },
    include: {
      movementScans: {
        orderBy: { uploadedAt: "desc" },
        include: {
          findings: true,
          plans: {
            orderBy: { priorityRank: "asc" },
            include: { items: { orderBy: { order: "asc" }, include: { exercise: true } } },
          },
        },
      },
    },
  });

  if (!client) notFound();

  return (
    <main className="flex-1 max-w-3xl mx-auto px-6 py-16">
      <p className="text-sm text-slate-400">
        <Link href="/clients" className="hover:underline">
          ← Kunden
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-extrabold">
        {client.firstName} {client.lastName}
      </h1>
      <p className="mt-1 text-slate-500">{client.email}</p>

      <section className="mt-8 rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold">SmartMotionScan hochladen</h2>
        <div className="mt-4">
          <UploadForm clientId={client.id} />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold text-lg">Scan- &amp; Plan-Verlauf</h2>
        {client.movementScans.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">Noch keine Scans hochgeladen.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-8">
            {/* `: any` annotations below are SANDBOX-ONLY, see
                src/lib/db.ts — @prisma/client's generated types don't
                exist in this environment. */}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {client.movementScans.map((scan: any) => (
              <div key={scan.id} className="rounded-xl border border-slate-200 p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-ink-900">{scan.fileName}</p>
                    <p className="text-xs text-slate-400">
                      {scan.uploadedAt.toLocaleDateString("de-DE")} · Status: {scan.status}
                    </p>
                  </div>
                </div>

                {scan.findings.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-slate-500">Erfasste Befunde</p>
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
                      {scan.findings.map((f: any) => (
                        <li
                          key={f.id}
                          className="text-[11px] rounded-full bg-slate-100 text-slate-600 px-2 py-0.5"
                        >
                          {COMPENSATION_LABELS[f.compensation] ?? f.compensation}
                          {f.side !== "BILATERAL" && ` (${f.side === "LEFT" ? "links" : "rechts"})`}
                          {f.severity && ` · ${f.severity}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {scan.plans.length > 0 ? (
                  <div className="mt-5 flex flex-col gap-6">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
                    {scan.plans.map((plan: any) => (
                      <CorrectivePlanCard key={plan.id} plan={plan} />
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-400">Kein Plan generiert.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
