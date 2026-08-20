import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { requireAdmin, AdminAuthRequiredError } from "@/lib/adminAuth";

// CoachAdmin briefing §6/§7 — assigning/removing a customer's segment
// membership(s). Deliberately a plain many-to-many join (see
// CustomerSegmentMembership in schema.prisma) rather than a single
// "primarySegment" field, since the briefing never states a customer can
// only ever have one segment — but the admin UI (SegmentsPanel) still
// defaults to showing/managing this as "pick the segments that apply."
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof AdminAuthRequiredError) {
      return Response.json({ error: "Nicht als Coach angemeldet." }, { status: 401 });
    }
    throw err;
  }

  const { id: clientId } = await params;
  const provider = await getActiveProvider();
  const client = await prisma.client.findFirst({ where: { id: clientId, providerId: provider.id } });
  if (!client) {
    return Response.json({ error: "Kunde nicht gefunden." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  const { segmentId, action } = (body ?? {}) as Record<string, unknown>;
  if (typeof segmentId !== "string" || (action !== "assign" && action !== "unassign")) {
    return Response.json({ error: "segmentId/action fehlt oder ungültig." }, { status: 400 });
  }

  const segment = await prisma.customerSegment.findFirst({ where: { id: segmentId, providerId: provider.id } });
  if (!segment) {
    return Response.json({ error: "Segment nicht gefunden." }, { status: 404 });
  }

  if (action === "assign") {
    await prisma.customerSegmentMembership.upsert({
      where: { clientId_segmentId: { clientId: client.id, segmentId: segment.id } },
      update: {},
      create: { clientId: client.id, segmentId: segment.id, assignedBy: admin.id },
    });
  } else {
    await prisma.customerSegmentMembership.deleteMany({
      where: { clientId: client.id, segmentId: segment.id },
    });
  }

  return Response.json({ ok: true });
}
