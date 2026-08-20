import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { requireAdmin, AdminAuthRequiredError } from "@/lib/adminAuth";

const VALID_TYPES = ["COACHING_SESSION", "COACHING_PACKAGE", "SMARTMOTION_SCAN", "DIGITAL_TRAINING_PLAN", "COMPLIMENTARY"];
const VALID_VISIBILITY = ["ALL", "SEGMENTS", "CUSTOMERS"];

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
  const { name, description, priceCents, currency, credits, validityDays, stripePriceId, active, visibility, visibleToCustomers, type } =
    (body ?? {}) as Record<string, unknown>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts
  const data: any = {};
  if (typeof name === "string" && name.trim()) data.name = name.trim();
  if (typeof description === "string" || description === null) data.description = description || null;
  if (typeof priceCents === "number" && Number.isFinite(priceCents) && priceCents >= 0) data.priceCents = Math.round(priceCents);
  if (typeof currency === "string" && currency.trim()) data.currency = currency.trim().toUpperCase();
  if (typeof credits === "number" || credits === null) data.credits = credits === null ? null : Math.round(credits as number);
  if (typeof validityDays === "number" || validityDays === null) data.validityDays = validityDays === null ? null : Math.round(validityDays as number);
  if (typeof stripePriceId === "string" || stripePriceId === null) data.stripePriceId = stripePriceId || null;
  if (typeof active === "boolean") data.active = active;
  if (typeof visibleToCustomers === "boolean") data.visibleToCustomers = visibleToCustomers;
  if (typeof visibility === "string" && VALID_VISIBILITY.includes(visibility)) data.visibility = visibility;
  if (typeof type === "string" && VALID_TYPES.includes(type)) data.type = type;

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "Keine Änderungen übermittelt." }, { status: 400 });
  }

  const updated = await prisma.product.update({ where: { id: product.id }, data });
  return Response.json({ ok: true, product: updated });
}

// Products can be genuinely deleted (unlike Client, which is archived) —
// a product is catalog config, not a customer's history. Guard against
// deleting one that's already in use as an entitlement source: real
// PackageEntitlement rows (P3) plus any leftover legacy CreditBalance
// rows (superseded but still checked defensively, see that model's
// schema.prisma comment).
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
  const product = await prisma.product.findFirst({ where: { id, providerId: provider.id } });
  if (!product) {
    return Response.json({ error: "Produkt nicht gefunden." }, { status: 404 });
  }

  const [entitlementsInUse, legacyCreditBalancesInUse] = await Promise.all([
    prisma.packageEntitlement.count({ where: { productId: product.id } }),
    prisma.creditBalance.count({ where: { productId: product.id } }),
  ]);
  if (entitlementsInUse > 0 || legacyCreditBalancesInUse > 0) {
    return Response.json(
      { error: "Produkt wird bereits von Kontingenten verwendet und kann nicht gelöscht werden — stattdessen deaktivieren." },
      { status: 400 },
    );
  }

  await prisma.productPrice.deleteMany({ where: { productId: product.id } });
  await prisma.productAccessRule.deleteMany({ where: { productId: product.id } });
  await prisma.bookingLink.updateMany({ where: { productId: product.id }, data: { productId: null } });
  await prisma.product.delete({ where: { id: product.id } });

  return Response.json({ ok: true });
}
