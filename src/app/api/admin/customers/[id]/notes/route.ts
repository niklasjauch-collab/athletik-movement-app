import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { requireAdmin, AdminAuthRequiredError } from "@/lib/adminAuth";

// CoachAdmin briefing §41 — internal coach notes, never shown to the
// customer. POST creates a note; PATCH toggles pinned on an existing one
// (id passed in the body, since notes don't get their own [noteId] route
// segment for a two-op resource this small).
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
  const { text, pinned } = (body ?? {}) as Record<string, unknown>;
  if (typeof text !== "string" || !text.trim()) {
    return Response.json({ error: "Notiztext fehlt." }, { status: 400 });
  }

  const note = await prisma.coachNote.create({
    data: {
      clientId: client.id,
      authorId: admin.id,
      text: text.trim(),
      pinned: pinned === true,
    },
  });

  return Response.json({ ok: true, note });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
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
  const { noteId, pinned } = (body ?? {}) as Record<string, unknown>;
  if (typeof noteId !== "string" || typeof pinned !== "boolean") {
    return Response.json({ error: "noteId/pinned fehlt." }, { status: 400 });
  }

  const note = await prisma.coachNote.findFirst({ where: { id: noteId, clientId: client.id } });
  if (!note) {
    return Response.json({ error: "Notiz nicht gefunden." }, { status: 404 });
  }

  const updated = await prisma.coachNote.update({ where: { id: note.id }, data: { pinned } });
  return Response.json({ ok: true, note: updated });
}
