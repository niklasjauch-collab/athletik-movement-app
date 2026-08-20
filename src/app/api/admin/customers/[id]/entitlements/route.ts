import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { requireAdmin, AdminAuthRequiredError } from "@/lib/adminAuth";
import { createManualEntitlement } from "@/lib/creditLedger";

// CoachAdmin briefing §16 — "Neues Kontingent vergeben": always creates a
// brand-new PackageEntitlement, never tops up an existing one (§16's own
// "2 Rest + neues 15er = 17 verfügbar, nicht 15" example). This is also
// the manual-sale path since P7 (Stripe) doesn't exist yet.
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
  const unlimited = b.unlimited === true;
  const label = typeof b.label === "string" ? b.label.trim() : "";
  const totalCredits = typeof b.totalCredits === "number" && Number.isFinite(b.totalCredits) ? Math.trunc(b.totalCredits) : 0;
  const expiresAt = typeof b.expiresAt === "string" && b.expiresAt ? new Date(b.expiresAt) : null;
  const note = typeof b.note === "string" && b.note.trim() ? b.note.trim() : null;

  if (!label) {
    return Response.json({ error: "Bezeichnung fehlt." }, { status: 400 });
  }
  if (!unlimited && totalCredits <= 0) {
    return Response.json({ error: "Anzahl Einheiten muss größer als 0 sein (oder „unbegrenzt“ wählen)." }, { status: 400 });
  }

  if (productId) {
    const product = await prisma.product.findFirst({ where: { id: productId, providerId: provider.id } });
    if (!product) {
      return Response.json({ error: "Produkt nicht gefunden." }, { status: 404 });
    }
  }

  const entitlement = await createManualEntitlement({
    clientId: client.id,
    productId,
    label,
    totalCredits,
    unlimited,
    expiresAt,
    note,
    adminId: admin.id,
  });

  return Response.json({ ok: true, entitlement });
}
