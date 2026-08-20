import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { getCurrentClient } from "@/lib/auth";
import { getCurrentAdmin } from "@/lib/adminAuth";
import { getActiveProvider } from "@/lib/tenant";

// Lets a logged-in client download their own SmartMotionScan report (the
// file the coach uploaded via /clients/[id]). Scoped to `clientId: client.id`
// so one client can never fetch another client's report by guessing an id.
//
// §36 "Report"-column on /admin/scans needs this to also work for the
// coach — tries the client branch first (unchanged), then falls back to
// an admin session scoped to `providerId` (not `clientId`, since the
// coach isn't the client) so a coach can re-download any report they
// uploaded for their own provider's customers.
//
// TODO (before real production use): reads from local disk
// (`.uploads/scans/`, see api/clients/[id]/scans/route.ts) — files are
// lost on Railway redeploy since there's no persistent/object storage
// wired up yet. The 404 branch below explains this rather than failing
// silently.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const client = await getCurrentClient();
  let scan;
  if (client) {
    scan = await prisma.movementScan.findFirst({ where: { id, clientId: client.id } });
  } else {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return new Response("Nicht angemeldet.", { status: 401 });
    }
    const provider = await getActiveProvider();
    scan = await prisma.movementScan.findFirst({ where: { id, providerId: provider.id } });
  }
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
