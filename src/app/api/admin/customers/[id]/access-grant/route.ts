import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { requireAdmin, AdminAuthRequiredError } from "@/lib/adminAuth";
import { syncAccessGrantEntitlement } from "@/lib/creditLedger";

// CoachAdmin briefing §8 (Beta Tester) + §9 (Freunde/Family) — "Zugang
// verwalten." One upsert per customer (see CustomerAccessGrant's schema
// comment for why this is a single current-state row, not a history
// list). PUT replaces the whole grant; sending an all-false/empty body is
// how a coach revokes everything without deleting the row (keeps
// createdBy/createdAt history of when a grant was first set up).
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const toDate = (v: unknown) => (typeof v === "string" && v ? new Date(v) : null);
  const toBool = (v: unknown) => v === true;
  const toStr = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const toInt = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : null);

  const data = {
    validFrom: toDate(b.validFrom),
    validUntil: toDate(b.validUntil),
    appAccessGranted: toBool(b.appAccessGranted),
    scanResultAccessGranted: toBool(b.scanResultAccessGranted),
    allProductsGranted: toBool(b.allProductsGranted),
    coachingAccessNote: toStr(b.coachingAccessNote),
    sessionsGranted: toInt(b.sessionsGranted),
    sessionsUnlimited: toBool(b.sessionsUnlimited),
    specialBookingLinkUrl: toStr(b.specialBookingLinkUrl),
    note: toStr(b.note),
    createdBy: admin.id,
  };

  const grant = await prisma.customerAccessGrant.upsert({
    where: { clientId: client.id },
    update: data,
    create: { clientId: client.id, ...data },
  });

  // P3: keep sessionsGranted/sessionsUnlimited backed by a real, usable
  // PackageEntitlement instead of staying just recorded intent — see
  // syncAccessGrantEntitlement's doc comment.
  await syncAccessGrantEntitlement(client.id, grant, admin.id);

  return Response.json({ ok: true, grant });
}
