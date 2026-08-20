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
  const link = await prisma.bookingLink.findFirst({ where: { id, providerId: provider.id } });
  if (!link) {
    return Response.json({ error: "Buchungslink nicht gefunden." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  const { name, url, type, productId, segmentId, description, active } = (body ?? {}) as Record<string, unknown>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts
  const data: any = {};
  if (typeof name === "string" && name.trim()) data.name = name.trim();
  if (typeof url === "string" && url.trim()) data.url = url.trim();
  if (typeof type === "string" || type === null) data.type = type || null;
  if (typeof productId === "string" || productId === null) data.productId = productId || null;
  if (typeof segmentId === "string" || segmentId === null) data.segmentId = segmentId || null;
  if (typeof description === "string" || description === null) data.description = description || null;
  if (typeof active === "boolean") data.active = active;

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "Keine Änderungen übermittelt." }, { status: 400 });
  }

  const updated = await prisma.bookingLink.update({ where: { id: link.id }, data });
  return Response.json({ ok: true, link: updated });
}

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
  const link = await prisma.bookingLink.findFirst({ where: { id, providerId: provider.id } });
  if (!link) {
    return Response.json({ error: "Buchungslink nicht gefunden." }, { status: 404 });
  }

  await prisma.bookingLink.delete({ where: { id: link.id } });
  return Response.json({ ok: true });
}
