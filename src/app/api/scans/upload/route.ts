import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

// Receives a SmartMotionScan (or any other movement-assessment) report
// file plus a clientId, and stores it.
//
// TODO (before deploying to Vercel/production): this currently writes to
// the LOCAL filesystem under .uploads/scans/, which only works when
// running `next dev`/`next start` on a machine with a persistent disk.
// Vercel's serverless functions have an ephemeral, read-only filesystem
// in production — files written here will NOT survive between requests.
// Before going live, swap the body of this handler for an upload to real
// object storage (Vercel Blob, Supabase Storage, or S3), store the
// resulting URL, and create the MovementScan row via Prisma
// (prisma.movementScan.create({ data: { providerId, clientId, fileUrl,
// fileName, contentType } })) instead of just returning JSON.
export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const clientId = formData.get("clientId");

  if (!(file instanceof File)) {
    return Response.json({ error: "Keine Datei übermittelt." }, { status: 400 });
  }
  if (typeof clientId !== "string" || !clientId) {
    return Response.json({ error: "clientId fehlt." }, { status: 400 });
  }

  const uploadsDir = path.join(process.cwd(), ".uploads", "scans");
  await mkdir(uploadsDir, { recursive: true });

  const safeExt = path.extname(file.name).slice(0, 10);
  const storedName = `${randomUUID()}${safeExt}`;
  const storedPath = path.join(uploadsDir, storedName);

  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(storedPath, bytes);

  // TODO: prisma.movementScan.create({ ... }) once DATABASE_URL is wired
  // up (see README) — for now the caller (src/app/scans/page.tsx) keeps
  // the returned metadata in client-side state for the rest of the demo
  // flow (findings entry + plan generation), consistent with the other
  // Phase 1 placeholder pages.
  return Response.json({
    fileName: file.name,
    fileUrl: `/.uploads/scans/${storedName}`, // local-dev-only path, see TODO above
    contentType: file.type || null,
    clientId,
    uploadedAt: new Date().toISOString(),
  });
}
