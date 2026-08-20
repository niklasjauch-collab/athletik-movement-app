// CoachAdmin briefing §34 PLAN DUPLIZIEREN + §35 TEMPLATE -> KUNDENPLAN.
// Both are the same underlying operation — a full, independent copy of a
// TrainingPlan and its items — so they share this one helper rather than
// duplicating the copy logic per action:
//   - §34 "Duplizieren": duplicateTrainingPlan(plan) with no clientId
//     override keeps the same kind/client, e.g. cloning a client's plan
//     into a fresh DRAFT before trying a variation.
//   - §34's own example ("...neuem Kunden zuweisen") and §35 (assigning a
//     Template to a client): duplicateTrainingPlan(plan, { clientId })
//     forces kind=INDIVIDUAL and sets the target client.
// Either way the result is a brand-new row with its own items — editing it
// afterwards can never reach back and silently change the source plan, and
// editing the source later can never silently change this copy (§35's
// explicit requirement).
import { prisma } from "@/lib/db";

export async function duplicateTrainingPlan(sourceId: string, opts?: { clientId?: string | null }) {
  const source = await prisma.trainingPlan.findUnique({
    where: { id: sourceId },
    include: { items: { orderBy: { order: "asc" } } },
  });
  if (!source) return null;

  const forcedClientId = opts && "clientId" in opts ? opts.clientId ?? null : undefined;
  const nextClientId = forcedClientId !== undefined ? forcedClientId : source.clientId;
  const nextKind = forcedClientId ? "INDIVIDUAL" : source.kind;
  // Propagate template lineage transitively: duplicating a Template records
  // it directly; duplicating a plan that itself came from a Template keeps
  // pointing at that same original Template rather than the intermediate
  // copy, so "aus Template X erstellt" always names the real source.
  const assignedFromTemplateId =
    source.kind === "TEMPLATE" ? source.id : source.assignedFromTemplateId ?? null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts
  return prisma.$transaction(async (tx: any) => {
    const copy = await tx.trainingPlan.create({
      data: {
        providerId: source.providerId,
        kind: nextKind,
        status: "DRAFT",
        title: forcedClientId ? source.title : `${source.title} (Kopie)`,
        description: source.description,
        goal: source.goal,
        durationWeeks: source.durationWeeks,
        frequencyPerWeek: source.frequencyPerWeek,
        clientId: nextClientId,
        assignedFromTemplateId,
      },
    });

    if (source.items.length > 0) {
      await tx.trainingPlanExercise.createMany({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts
        data: source.items.map((item: any) => ({
          trainingPlanId: copy.id,
          exerciseId: item.exerciseId,
          order: item.order,
          setsOverride: item.setsOverride,
          pauseSecondsOverride: item.pauseSecondsOverride,
          notes: item.notes,
          // digitalProductId intentionally NOT copied — that link is
          // specific to the source SELLABLE plan's shop listing, not to
          // this new copy (which may not even be SELLABLE anymore).
        })),
      });
    }

    return tx.trainingPlan.findUnique({ where: { id: copy.id }, include: { items: { orderBy: { order: "asc" } } } });
  });
}

/// §38: names of exercises in a plan that have neither a male nor a female
/// video (URL or legacy migration path) — used to block PUBLISH and to
/// show the coach exactly what's missing.
export async function planMissingVideoExerciseNames(planId: string): Promise<string[]> {
  const items = await prisma.trainingPlanExercise.findMany({
    where: { trainingPlanId: planId },
    include: { exercise: true },
    orderBy: { order: "asc" },
  });
  const missing = items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts
    .filter((i: any) => !i.exercise.videoMaleUrl && !i.exercise.videoFemaleUrl && !i.exercise.videoMalePath && !i.exercise.videoFemalePath)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts
    .map((i: any) => i.exercise.name as string);
  return Array.from(new Set(missing));
}
