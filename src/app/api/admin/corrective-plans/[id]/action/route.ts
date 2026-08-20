// CoachAdmin briefing §36/§69: "Plan überprüfen -> veröffentlichen ->
// Kunde erhält Zugriff." A CorrectivePlan is generated with
// status=REVIEW_REQUIRED (see src/app/api/clients/[id]/scans/route.ts);
// this route is the only way it becomes visible to the client
// (src/app/app/page.tsx filters on status=PUBLISHED). Single
// discriminated-union action route, same pattern as
// /api/admin/plans/[id]/action and /api/admin/appointments/[id]/action.
import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { requireAdmin, AdminAuthRequiredError } from "@/lib/adminAuth";

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
  const plan = await prisma.correctivePlan.findFirst({ where: { id, providerId: provider.id } });
  if (!plan) return Response.json({ error: "Plan nicht gefunden." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  const { action } = (body ?? {}) as Record<string, unknown>;

  if (action === "PUBLISH") {
    const updated = await prisma.correctivePlan.update({
      where: { id: plan.id },
      // literal string constants below — immune to the enum-cast build
      // failure documented in the P5 status notes (TS treats a literal
      // as its own singleton type, not `string`).
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
    return Response.json({ ok: true, plan: updated });
  }

  if (action === "UNPUBLISH") {
    const updated = await prisma.correctivePlan.update({
      where: { id: plan.id },
      data: { status: "REVIEW_REQUIRED", publishedAt: null },
    });
    return Response.json({ ok: true, plan: updated });
  }

  return Response.json({ error: "Unbekannte Aktion." }, { status: 400 });
}
