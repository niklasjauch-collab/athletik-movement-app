import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { requireAdmin, AdminAuthRequiredError } from "@/lib/adminAuth";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; priceId: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AdminAuthRequiredError) {
      return Response.json({ error: "Nicht als Coach angemeldet." }, { status: 401 });
    }
    throw err;
  }

  const { id, priceId } = await params;
  const provider = await getActiveProvider();
  const product = await prisma.product.findFirst({ where: { id, providerId: provider.id } });
  if (!product) {
    return Response.json({ error: "Produkt nicht gefunden." }, { status: 404 });
  }

  await prisma.productPrice.deleteMany({ where: { id: priceId, productId: product.id } });
  return Response.json({ ok: true });
}
