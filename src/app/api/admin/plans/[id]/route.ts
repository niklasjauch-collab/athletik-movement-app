// CoachAdmin briefing §33 PLAN BUILDER — the Builder edits everything
// (basic fields + the full ordered exercise list) as one screen and saves
// it in one shot, so PATCH here accepts the whole plan shape and replaces
// the item list transactionally (delete-all + recreate) rather than
// diffing — simpler and safe since order/content is always fully
// resubmitted by the editor, never partially.
import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { requireAdmin, AdminAuthRequiredError } from "@/lib/adminAuth";

type ItemInput = {
  exerciseId: string;
  order: number;
  setsOverride?: number[];
  pauseSecondsOverride?: number | null;
  notes?: string | null;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AdminAuthRequiredError) {
      return Response.json({ error: "Nicht als Coach angemeldet." }, { status: 401 });
    }
    throw err;
  }

  const { id } = await params;
  const provider = await getActiveProvider();
  const plan = await prisma.trainingPlan.findFirst({ where: { id, providerId: provider.id } });
  if (!plan) return Response.json({ error: "Plan nicht gefunden." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  const { title, description, goal, durationWeeks, frequencyPerWeek, items } = (body ?? {}) as Record<string, unknown>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts
  const data: any = {};
  if (typeof title === "string" && title.trim()) data.title = title.trim();
  if (typeof description === "string" || description === null) data.description = description || null;
  if (typeof goal === "string" || goal === null) data.goal = goal || null;
  if (typeof durationWeeks === "number" || durationWeeks === null) data.durationWeeks = durationWeeks;
  if (typeof frequencyPerWeek === "number" || frequencyPerWeek === null) data.frequencyPerWeek = frequencyPerWeek;

  let itemsInput: ItemInput[] | null = null;
  if (Array.isArray(items)) {
    itemsInput = items.filter(
      (i): i is ItemInput => Boolean(i) && typeof (i as ItemInput).exerciseId === "string" && typeof (i as ItemInput).order === "number",
    );
  }

  if (Object.keys(data).length === 0 && itemsInput === null) {
    return Response.json({ error: "Keine Änderungen übermittelt." }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts
  await prisma.$transaction(async (tx: any) => {
    if (Object.keys(data).length > 0) {
      await tx.trainingPlan.update({ where: { id: plan.id }, data });
    }
    if (itemsInput) {
      await tx.trainingPlanExercise.deleteMany({ where: { trainingPlanId: plan.id } });
      if (itemsInput.length > 0) {
        await tx.trainingPlanExercise.createMany({
          data: itemsInput.map((item, index) => ({
            trainingPlanId: plan.id,
            exerciseId: item.exerciseId,
            order: item.order ?? index,
            setsOverride: Array.isArray(item.setsOverride) ? item.setsOverride : [],
            pauseSecondsOverride: typeof item.pauseSecondsOverride === "number" ? item.pauseSecondsOverride : null,
            notes: item.notes || null,
          })),
        });
      }
    }
  });

  const updated = await prisma.trainingPlan.findUnique({
    where: { id: plan.id },
    include: { items: { orderBy: { order: "asc" }, include: { exercise: true } } },
  });
  return Response.json({ ok: true, plan: updated });
}

// Templates/plans can only be deleted while they're still empty scaffolding
// — no items, no client history and nothing was ever duplicated from them.
// Anything with real content should be archived instead (§32 Archiv),
// same "don't destroy history, park it" reasoning as Client.archivedAt.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AdminAuthRequiredError) {
      return Response.json({ error: "Nicht als Coach angemeldet." }, { status: 401 });
    }
    throw err;
  }

  const { id } = await params;
  const provider = await getActiveProvider();
  const plan = await prisma.trainingPlan.findFirst({
    where: { id, providerId: provider.id },
    include: { _count: { select: { items: true, trainingSessions: true, assignedCopies: true } } },
  });
  if (!plan) return Response.json({ error: "Plan nicht gefunden." }, { status: 404 });

  if (plan._count.items > 0 || plan._count.trainingSessions > 0 || plan._count.assignedCopies > 0) {
    return Response.json(
      { error: "Plan enthält bereits Übungen, Trainingssitzungen oder daraus zugewiesene Kopien — stattdessen archivieren." },
      { status: 400 },
    );
  }

  await prisma.trainingPlan.delete({ where: { id: plan.id } });
  return Response.json({ ok: true });
}
