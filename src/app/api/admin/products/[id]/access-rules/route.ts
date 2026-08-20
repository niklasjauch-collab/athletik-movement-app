import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { requireAdmin, AdminAuthRequiredError } from "@/lib/adminAuth";

// CoachAdmin briefing §25 — one row per segment/customer allowed to see
// a SEGMENTS/CUSTOMERS-visibility product. Only meaningful once the
// product's own `visibility` field has been set away from ALL (the
// product PATCH route handles that field) — this route just adds/removes
// individual allow-list entries.
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
  const { segmentId, customerId } = (body ?? {}) as Record<string, unknown>;
  if (typeof segmentId !== "string" && typeof customerId !== "string") {
    return Response.json({ error: "Segment oder Kunde fehlt." }, { status: 400 });
  }

  const rule = await prisma.productAccessRule.upsert({
    where:
      typeof segmentId === "string"
        ? { productId_segmentId: { productId: product.id, segmentId } }
        : { productId_customerId: { productId: product.id, customerId: customerId as string } },
    update: {},
    create: {
      productId: product.id,
      segmentId: typeof segmentId === "string" ? segmentId : null,
      customerId: typeof customerId === "string" ? customerId : null,
    },
  });

  return Response.json({ ok: true, rule });
}
