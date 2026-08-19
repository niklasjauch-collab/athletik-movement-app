import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { getCurrentClient } from "@/lib/auth";

// Lets a logged-in client download their own SmartMotionScan report (the
// file the coach uploaded via /clients/[id]). Scoped to `clientId: client.id`
// so one client can never fetch another client's report by guessing an id.
//
// TODO (coach access): there's no coach login yet (single-operator beta,
// see project status doc), so this route only serves the owning client —
// once coach auth exists, add a second branch here for the coach to
// re-download reports they uploaded.
//
// TODO (before real production use): reads from local disk
// (`.uploads/scans/`, see api/clients/[id]/scans/route.ts) — files are
// lost on Railway redeploy since there's no persistent/object storage
// wired up yet. The 404 branch below explains this rather than failing
// silently.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const client = await getCurrentClient();
  if (!client) {
    return new Response("Nicht angemeldet.", { status: 401 });
  }

  const scan = await prisma.movementScan.findFirst({
    where: { id, clientId: client.id },
  });
  if (!scan) {
    return new Response("Scanbericht nicht gefunden.", { status: 404 });
  }

  const filePath = path.join(process.cwd(), scan.fileUrl.replace(/^\//, ""));
  let bytes: Buffer;
  try {
    bytes = await readFile(filePath);
  } catch {
    return new Response(
      "Diese Datei ist auf dem Server aktuell nicht verfügbar (z. B. nach einem Neustart/Deploy). Bitte beim Trainer melden.",
      { status: 404 },
    );
  }

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": scan.contentType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${scan.fileName.replace(/"/g, "")}"`,
    },
  });
}
