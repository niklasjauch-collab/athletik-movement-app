import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { requireAdmin, AdminAuthRequiredError } from "@/lib/adminAuth";

// CoachAdmin briefing §18 Calendly Link Manager.
export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AdminAuthRequiredError) {
      return Response.json({ error: "Nicht als Coach angemeldet." }, { status: 401 });
    }
    throw err;
  }
  const provider = await getActiveProvider();
  const links = await prisma.bookingLink.findMany({
    where: { providerId: provider.id },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { product: { select: { id: true, name: true } }, segment: { select: { id: true, name: true } } },
  });
  return Response.json({ links });
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AdminAuthRequiredError) {
      return Response.json({ error: "Nicht als Coach angemeldet." }, { status: 401 });
    }
    throw err;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  const { name, url, type, productId, segmentId, description } = (body ?? {}) as Record<string, unknown>;
  if (typeof name !== "string" || !name.trim()) {
    return Response.json({ error: "Name fehlt." }, { status: 400 });
  }
  if (typeof url !== "string" || !url.trim()) {
    return Response.json({ error: "URL fehlt." }, { status: 400 });
  }

  const provider = await getActiveProvider();
  const link = await prisma.bookingLink.create({
    data: {
      providerId: provider.id,
      name: name.trim(),
      url: url.trim(),
      type: typeof type === "string" ? type.trim() || null : null,
      productId: typeof productId === "string" && productId ? productId : null,
      segmentId: typeof segmentId === "string" && segmentId ? segmentId : null,
      description: typeof description === "string" ? description.trim() || null : null,
      active: true,
    },
  });

  return Response.json({ ok: true, link });
}
