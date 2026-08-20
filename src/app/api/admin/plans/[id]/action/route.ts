// CoachAdmin briefing §32 Archiv, §34 PLAN DUPLIZIEREN, §35 TEMPLATE ->
// KUNDENPLAN, §38 "PUBLISH PLAN [blockieren] wenn darin eine Übung ohne
// Video enthalten ist" — same discriminated single-action-route pattern
// as /api/admin/appointments/[id]/action from P4.
import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { requireAdmin, AdminAuthRequiredError } from "@/lib/adminAuth";
import { duplicateTrainingPlan, planMissingVideoExerciseNames } from "@/lib/trainingPlans";

const ACTIONS = ["DUPLICATE", "PUBLISH", "UNPUBLISH", "ARCHIVE", "UNARCHIVE"] as const;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const { action, clientId } = (body ?? {}) as Record<string, unknown>;
  if (typeof action !== "string" || !ACTIONS.includes(action as (typeof ACTIONS)[number])) {
    return Response.json({ error: "Unbekannte Aktion." }, { status: 400 });
  }

  switch (action) {
    case "DUPLICATE": {
      const targetClientId = typeof clientId === "string" && clientId ? clientId : null;
      if (targetClientId) {
        const client = await prisma.client.findFirst({ where: { id: targetClientId, providerId: provider.id } });
        if (!client) return Response.json({ error: "Kunde nicht gefunden." }, { status: 404 });
      }
      const copy = await duplicateTrainingPlan(plan.id, targetClientId !== null ? { clientId: targetClientId } : undefined);
      return Response.json({ ok: true, plan: copy });
    }

    case "PUBLISH": {
      // §38: block publish while any exercise in the plan has no video.
      const missing = await planMissingVideoExerciseNames(plan.id);
      if (missing.length > 0) {
        return Response.json(
          {
            error: `Plan kann nicht veröffentlicht werden. ${missing.length} Übung(en) ${missing.length === 1 ? "hat" : "haben"} kein Video: ${missing.join(", ")}.`,
          },
          { status: 400 },
        );
      }
      const updated = await prisma.trainingPlan.update({ where: { id: plan.id }, data: { status: "PUBLISHED" } });
      return Response.json({ ok: true, plan: updated });
    }

    case "UNPUBLISH": {
      const updated = await prisma.trainingPlan.update({ where: { id: plan.id }, data: { status: "DRAFT" } });
      return Response.json({ ok: true, plan: updated });
    }

    case "ARCHIVE": {
      const updated = await prisma.trainingPlan.update({ where: { id: plan.id }, data: { status: "ARCHIVED" } });
      return Response.json({ ok: true, plan: updated });
    }

    case "UNARCHIVE": {
      const updated = await prisma.trainingPlan.update({ where: { id: plan.id }, data: { status: "DRAFT" } });
      return Response.json({ ok: true, plan: updated });
    }
  }

  return Response.json({ error: "Unbekannte Aktion." }, { status: 400 });
}
