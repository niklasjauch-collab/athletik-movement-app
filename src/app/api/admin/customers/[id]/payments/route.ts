import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { requireAdmin, AdminAuthRequiredError } from "@/lib/adminAuth";
import { recordManualPayment } from "@/lib/payments";

// CoachAdmin briefing §30 "Zahlung manuell hinzufügen" — Produkt, Betrag,
// Zahlungsart, Datum, Notiz. Optionally grants a Kontingent-Entitlement in
// the same call (§30's "danach entsprechendes Entitlement erstellen"),
// pre-filled from the chosen Product the same way the P3 entitlements
// route pre-fills label/credits from a Product.
const VALID_METHODS = ["BANK_TRANSFER", "CASH", "EXTERNAL_INVOICE", "GOODWILL", "FREE"] as const;
type Method = (typeof VALID_METHODS)[number];

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
  const b = (body ?? {}) as Record<string, unknown>;

  const productId = typeof b.productId === "string" && b.productId ? b.productId : null;
  const listPriceCents = typeof b.listPriceCents === "number" && Number.isFinite(b.listPriceCents) ? Math.round(b.listPriceCents) : NaN;
  const discountCents = typeof b.discountCents === "number" && Number.isFinite(b.discountCents) ? Math.round(b.discountCents) : 0;
  const amountCents = typeof b.amountCents === "number" && Number.isFinite(b.amountCents) ? Math.round(b.amountCents) : NaN;
  const methodRaw = typeof b.method === "string" ? b.method : "";
  const note = typeof b.note === "string" && b.note.trim() ? b.note.trim() : null;
  const paidAt = typeof b.paidAt === "string" && b.paidAt ? new Date(b.paidAt) : new Date();
  const grantCredits = typeof b.grantCredits === "number" && Number.isFinite(b.grantCredits) ? Math.trunc(b.grantCredits) : 0;
  const grantUnlimited = b.grantUnlimited === true;
  const grantLabel = typeof b.grantLabel === "string" ? b.grantLabel.trim() : "";

  if (!VALID_METHODS.includes(methodRaw as Method)) {
    return Response.json({ error: "Ungültige Zahlungsart." }, { status: 400 });
  }
  const method = methodRaw as Method;

  if (!Number.isFinite(listPriceCents) || listPriceCents < 0) {
    return Response.json({ error: "Listenpreis fehlt oder ist ungültig." }, { status: 400 });
  }
  if (!Number.isFinite(amountCents) || amountCents < 0) {
    return Response.json({ error: "Bezahlter Betrag fehlt oder ist ungültig." }, { status: 400 });
  }

  let product = null;
  if (productId) {
    product = await prisma.product.findFirst({ where: { id: productId, providerId: provider.id } });
    if (!product) {
      return Response.json({ error: "Produkt nicht gefunden." }, { status: 404 });
    }
  }

  const grantEntitlement =
    (grantCredits > 0 || grantUnlimited) && grantLabel
      ? { label: grantLabel, totalCredits: grantCredits, unlimited: grantUnlimited, expiresAt: null }
      : null;

  const payment = await recordManualPayment({
    providerId: provider.id,
    clientId: client.id,
    productId,
    listPriceCents,
    discountCents,
    amountCents,
    method,
    note,
    paidAt,
    adminId: admin.id,
    grantEntitlement,
  });

  return Response.json({ payment });
}
