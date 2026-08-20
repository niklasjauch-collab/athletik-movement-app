import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { requireAdmin, AdminAuthRequiredError } from "@/lib/adminAuth";

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
  const segment = await prisma.customerSegment.findFirst({ where: { id, providerId: provider.id } });
  if (!segment) {
    return Response.json({ error: "Segment nicht gefunden." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  const { name, description, colorHex } = (body ?? {}) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  if (typeof name === "string" && name.trim()) data.name = name.trim();
  if (typeof description === "string" || description === null) data.description = description || null;
  if (typeof colorHex === "string" || colorHex === null) data.colorHex = colorHex || null;

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "Keine Änderungen übermittelt." }, { status: 400 });
  }

  const updated = await prisma.customerSegment.update({ where: { id: segment.id }, data });
  return Response.json({ ok: true, segment: updated });
}

// §6 standard segments (isSystemDefault:true) can't be deleted — a coach
// creating custom segments (the whole point of §6's flexible system)
// should not be able to accidentally remove the seeded defaults that
// other logic may assume exist. Custom segments can always be deleted;
// any existing CustomerSegmentMembership rows for it are removed first so
// the delete doesn't fail on the FK.
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
  const segment = await prisma.customerSegment.findFirst({ where: { id, providerId: provider.id } });
  if (!segment) {
    return Response.json({ error: "Segment nicht gefunden." }, { status: 404 });
  }
  if (segment.isSystemDefault) {
    return Response.json({ error: "Standard-Segmente können nicht gelöscht werden." }, { status: 400 });
  }

  await prisma.customerSegmentMembership.deleteMany({ where: { segmentId: segment.id } });
  await prisma.customerSegment.delete({ where: { id: segment.id } });

  return Response.json({ ok: true });
}
