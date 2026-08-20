import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { requireAdmin, AdminAuthRequiredError } from "@/lib/adminAuth";

// CoachAdmin briefing §5 (Kundenstatus) + §10 (Legacy-Zuweisung) + §54
// (Account löschen vs. archivieren) in one small PATCH endpoint — these
// are all "edit a field on the Client row" operations, so one route
// keeps the API surface from ballooning into one file per field. Body is
// a partial: only the keys present are changed.
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
  const client = await prisma.client.findFirst({ where: { id, providerId: provider.id } });
  if (!client) {
    return Response.json({ error: "Kunde nicht gefunden." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  const { status, legacyProgramId, phone, archived } = (body ?? {}) as Record<string, unknown>;

  const data: Record<string, unknown> = {};

  const VALID_STATUSES = ["LEAD", "ACTIVE", "PAUSED", "INACTIVE", "ARCHIVED"];
  if (typeof status === "string") {
    if (!VALID_STATUSES.includes(status)) {
      return Response.json({ error: "Ungültiger Status." }, { status: 400 });
    }
    data.status = status;
  }

  if (legacyProgramId === null) {
    data.legacyProgramId = null;
  } else if (typeof legacyProgramId === "string") {
    const legacy = await prisma.legacyProgram.findFirst({
      where: { id: legacyProgramId, providerId: provider.id },
    });
    if (!legacy) {
      return Response.json({ error: "Legacy-Programm nicht gefunden." }, { status: 404 });
    }
    data.legacyProgramId = legacy.id;
  }

  if (typeof phone === "string" || phone === null) {
    data.phone = phone;
  }

  // §54: default customer-delete action must be ARCHIVIEREN, never a hard
  // delete — this endpoint only ever sets status:ARCHIVED + archivedAt,
  // it never calls prisma.client.delete(). There is deliberately no hard
  // delete endpoint yet.
  if (archived === true) {
    data.status = "ARCHIVED";
    data.archivedAt = new Date();
  } else if (archived === false) {
    data.archivedAt = null;
    if (!data.status) data.status = "ACTIVE";
  }

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "Keine Änderungen übermittelt." }, { status: 400 });
  }

  const updated = await prisma.client.update({ where: { id: client.id }, data });
  return Response.json({ ok: true, client: { id: updated.id, status: updated.status } });
}
