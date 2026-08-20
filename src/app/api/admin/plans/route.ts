// CoachAdmin briefing §32/§33 — creates a new, mostly-empty plan (just a
// title/kind, optionally a client) that the coach then fills in via the
// Plan Builder on /admin/plans/[id]. Kept separate from the PATCH route
// (which saves the builder's content) so "Neuer Plan" can redirect
// straight to an id before any exercises are chosen.
import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { requireAdmin, AdminAuthRequiredError } from "@/lib/adminAuth";

const VALID_KINDS = ["INDIVIDUAL", "SELLABLE", "TEMPLATE"];

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AdminAuthRequiredError) {
      return Response.json({ error: "Nicht als Coach angemeldet." }, { status: 401 });
    }
    throw err;
  }

  const provider = await getActiveProvider();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  const { title, kind, clientId } = (body ?? {}) as Record<string, unknown>;

  if (typeof title !== "string" || !title.trim()) {
    return Response.json({ error: "Titel fehlt." }, { status: 400 });
  }
  if (typeof kind !== "string" || !VALID_KINDS.includes(kind)) {
    return Response.json({ error: "Unbekannte Plan-Art." }, { status: 400 });
  }
  if (kind === "INDIVIDUAL" && (typeof clientId !== "string" || !clientId)) {
    return Response.json({ error: "Kundenplan braucht einen Kunden." }, { status: 400 });
  }

  if (typeof clientId === "string" && clientId) {
    const client = await prisma.client.findFirst({ where: { id: clientId, providerId: provider.id } });
    if (!client) return Response.json({ error: "Kunde nicht gefunden." }, { status: 404 });
  }

  const plan = await prisma.trainingPlan.create({
    data: {
      providerId: provider.id,
      title: title.trim(),
      kind,
      clientId: kind === "INDIVIDUAL" ? (clientId as string) : null,
    },
  });

  return Response.json({ ok: true, plan });
}
