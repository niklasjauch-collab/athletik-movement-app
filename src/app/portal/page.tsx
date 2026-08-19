import { redirect } from "next/navigation";
import { getCurrentClient } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CorrectivePlanCard } from "@/components/CorrectivePlanCard";

// Client-facing read-only view of the corrective exercise plan(s) the
// coach's scan upload generated automatically (see
// src/app/api/clients/[id]/scans/route.ts). No editing here — this is
// deliberately a mirror of what the coach set up, not a second place
// plans can drift out of sync.
export default async function PortalPage() {
  const client = await getCurrentClient();
  if (!client) redirect("/login?redirectTo=/portal");

  const plans = await prisma.correctivePlan.findMany({
    where: { clientId: client.id },
    orderBy: [{ generatedAt: "desc" }, { priorityRank: "asc" }],
    include: {
      items: { orderBy: { order: "asc" }, include: { exercise: true } },
      movementScan: true,
    },
  });

  if (plans.length === 0) {
    return (
      <main className="flex-1 max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-extrabold">Hallo {client.firstName}!</h1>
        <p className="mt-3 text-slate-500">
          Dein Trainer hat noch keinen Corrective-Exercise-Plan für dich hochgeladen. Sobald ein
          SmartMotionScan ausgewertet wurde, erscheint dein individueller Plan hier automatisch.
        </p>
      </main>
    );
  }

  // Most recent scan's plan(s) are "current"; everything from earlier
  // scans is shown below as history.
  // `: any` annotations below are SANDBOX-ONLY (see src/lib/db.ts):
  // `plans`' element type is `any` here only because @prisma/client's
  // generated types don't exist in this environment — remove them once
  // `npx prisma generate` can run somewhere with normal internet access.
  const latestScanId = plans[0].movementScanId;
  /* eslint-disable @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */
  const currentPlans = plans.filter((p: any) => p.movementScanId === latestScanId);
  const historicalPlans = plans.filter((p: any) => p.movementScanId !== latestScanId);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (
    <main className="flex-1 max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-extrabold">Hallo {client.firstName}!</h1>
      <p className="mt-2 text-slate-500">
        Dein individueller Corrective-Exercise-Plan, automatisch erstellt aus deinem letzten
        SmartMotionScan
        {currentPlans[0]?.generatedAt && (
          <> vom {currentPlans[0].generatedAt.toLocaleDateString("de-DE")}</>
        )}
        .
      </p>

      {currentPlans.length > 1 && (
        <p className="mt-3 rounded-lg bg-brand-50 text-brand-700 text-sm p-3">
          Dein Scan hat mehrere Befunde ergeben — dein Trainer hat deshalb {currentPlans.length}{" "}
          Pläne erstellt. Wechsle zwischen ihnen an unterschiedlichen Trainingstagen ab.
        </p>
      )}

      <div className="mt-8 flex flex-col gap-10">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
        {currentPlans.map((plan: any) => (
          <CorrectivePlanCard key={plan.id} plan={plan} />
        ))}
      </div>

      {historicalPlans.length > 0 && (
        <section className="mt-14 border-t border-slate-200 pt-8">
          <h2 className="text-lg font-semibold text-slate-600">Ältere Pläne</h2>
          <div className="mt-4 flex flex-col gap-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
            {historicalPlans.map((plan: any) => (
              <details key={plan.id} className="rounded-lg border border-slate-200 p-4">
                <summary className="cursor-pointer text-sm font-medium text-slate-600">
                  {plan.label ?? "Plan"} · {plan.generatedAt.toLocaleDateString("de-DE")} ({plan.items.length}{" "}
                  Übungen)
                </summary>
                <div className="mt-4">
                  <CorrectivePlanCard plan={plan} compact />
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
