import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { requireAdmin, AdminAuthRequiredError } from "@/lib/adminAuth";
import { adjustEntitlement } from "@/lib/creditLedger";

// §14 Manuelle Kontingentkorrektur — "Jede Änderung braucht: Wert, Grund,
// Admin, Datum. Keine stillen Änderungen." Admin+Datum come from the
// session/DB defaults; Wert+Grund are required request fields, enforced
// again inside adjustEntitlement (not just here).
export async function POST(request: Request, { params }: { params: Promise<{ id: string; entitlementId: string }> }) {
  let admin;
  try {
    admin = await requireAdmin();
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
  const bucket = b.bucket === "CONSUMED" ? "CONSUMED" : b.bucket === "TOTAL" ? "TOTAL" : null;
  const delta = typeof b.delta === "number" && Number.isFinite(b.delta) ? Math.trunc(b.delta) : NaN;
  const reason = typeof b.reason === "string" ? b.reason : "";

  if (!bucket) {
    return Response.json({ error: "Bucket (Gesamt/Verbraucht) fehlt." }, { status: 400 });
  }

  try {
    const entry = await adjustEntitlement({
      entitlementId: entitlement.id,
      bucket,
      delta,
      reason,
      adminId: admin.id,
    });
    return Response.json({ ok: true, entry });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Anpassung fehlgeschlagen.";
    return Response.json({ error: message }, { status: 400 });
  }
}
