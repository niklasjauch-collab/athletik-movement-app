import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { requireAdmin, AdminAuthRequiredError } from "@/lib/adminAuth";
import { setEntitlementExpiry, setEntitlementActive } from "@/lib/creditLedger";

// §17 — "Admin kann Ablaufdatum: automatisch berechnen, ändern,
// entfernen, verlängern." Sending expiresAt:null removes it (unbegrenzt).
// Also handles archiving an entitlement (active:false) without ever
// deleting its ledger history.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; entitlementId: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AdminAuthRequiredError) {
      return Response.json({ error: "Nicht als Coach angemeldet." }, { status: 401 });
    }
    throw err;
  }

  const { id: clientId, entitlementId } = await params;
  const provider = await getActiveProvider();
  const client = await prisma.client.findFirst({ where: { id: clientId, providerId: provider.id } });
  if (!client) {
    return Response.json({ error: "Kunde nicht gefunden." }, { status: 404 });
  }
  const entitlement = await prisma.packageEntitlement.findFirst({ where: { id: entitlementId, clientId: client.id } });
  if (!entitlement) {
    return Response.json({ error: "Kontingent nicht gefunden." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;

  if ("expiresAt" in b) {
    const expiresAt = typeof b.expiresAt === "string" && b.expiresAt ? new Date(b.expiresAt) : null;
    await setEntitlementExpiry(entitlement.id, expiresAt);
  }
  if ("active" in b) {
    await setEntitlementActive(entitlement.id, b.active === true);
  }

  const updated = await prisma.packageEntitlement.findUnique({ where: { id: entitlement.id } });
  return Response.json({ ok: true, entitlement: updated });
}
