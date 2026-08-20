import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { requireAdmin, AdminAuthRequiredError } from "@/lib/adminAuth";

// CoachAdmin briefing §26 Sonderpreise — creates one override row.
// Resolution priority (customer > segment > Product.priceCents default)
// lives in src/lib/commerceResolution.ts, not here; this route just
// records the override.
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
  const product = await prisma.product.findFirst({ where: { id, providerId: provider.id } });
  if (!product) {
    return Response.json({ error: "Produkt nicht gefunden." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  const { scope, customerId, segmentId, priceCents, reasonNote } = (body ?? {}) as Record<string, unknown>;

  if (scope !== "CUSTOMER" && scope !== "SEGMENT") {
    return Response.json({ error: "Ungültiger Geltungsbereich." }, { status: 400 });
  }
  if (typeof priceCents !== "number" || !Number.isFinite(priceCents) || priceCents < 0) {
    return Response.json({ error: "Ungültiger Preis." }, { status: 400 });
  }
  if (scope === "CUSTOMER" && (typeof customerId !== "string" || !customerId)) {
    return Response.json({ error: "Kunde fehlt." }, { status: 400 });
  }
  if (scope === "SEGMENT" && (typeof segmentId !== "string" || !segmentId)) {
    return Response.json({ error: "Segment fehlt." }, { status: 400 });
  }

  const price = await prisma.productPrice.upsert({
    where:
      scope === "CUSTOMER"
        ? { productId_customerId: { productId: product.id, customerId: customerId as string } }
        : { productId_segmentId: { productId: product.id, segmentId: segmentId as string } },
    update: { priceCents: Math.round(priceCents), reasonNote: typeof reasonNote === "string" ? reasonNote.trim() || null : null },
    create: {
      productId: product.id,
      scope,
      customerId: scope === "CUSTOMER" ? (customerId as string) : null,
      segmentId: scope === "SEGMENT" ? (segmentId as string) : null,
      priceCents: Math.round(priceCents),
      reasonNote: typeof reasonNote === "string" ? reasonNote.trim() || null : null,
    },
  });

  return Response.json({ ok: true, price });
}
