// CoachAdmin briefing §38 VIDEO MANAGEMENT. No object storage is
// configured in this environment yet (same gap already flagged in
// src/app/api/scans/upload/route.ts's TODO — local-disk writes don't
// survive Railway's ephemeral filesystem), so "hochladen/ersetzen" here
// means the coach pastes/replaces a playback URL (wherever the video is
// actually hosted — Vimeo/YouTube/S3/etc.) rather than uploading a binary
// file through this app. Swap this for real signed-upload storage once
// that's wired up; the Exercise fields themselves already match that
// future shape (videoMaleUrl/videoFemaleUrl/videoThumbnailUrl).
import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { requireAdmin, AdminAuthRequiredError } from "@/lib/adminAuth";

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
  const exercise = await prisma.exercise.findFirst({ where: { id, providerId: provider.id } });
  if (!exercise) return Response.json({ error: "Übung nicht gefunden." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  const { videoMaleUrl, videoFemaleUrl, videoThumbnailUrl, isPublished } = (body ?? {}) as Record<string, unknown>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts
  const data: any = {};
  if (typeof videoMaleUrl === "string" || videoMaleUrl === null) data.videoMaleUrl = videoMaleUrl || null;
  if (typeof videoFemaleUrl === "string" || videoFemaleUrl === null) data.videoFemaleUrl = videoFemaleUrl || null;
  if (typeof videoThumbnailUrl === "string" || videoThumbnailUrl === null) data.videoThumbnailUrl = videoThumbnailUrl || null;
  if (typeof isPublished === "boolean") data.isPublished = isPublished;

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "Keine Änderungen übermittelt." }, { status: 400 });
  }

  const updated = await prisma.exercise.update({ where: { id: exercise.id }, data });
  return Response.json({ ok: true, exercise: updated });
}
