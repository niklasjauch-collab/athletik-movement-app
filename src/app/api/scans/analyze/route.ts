import { analyzeScanDocument, AnalyzeScanConfigError } from "@/lib/corrective/analyzeScan";
import { requireAdmin, AdminAuthRequiredError } from "@/lib/adminAuth";

// Optional, opt-in step in the /admin/scans flow: run the uploaded
// SmartMotionScan report through analyzeScan.ts to get an AI-suggested
// findings list, which the UI then pre-fills into the SAME manual
// findings checklist the coach already reviews and edits before
// generating a plan (see analyzeScan.ts for the full rationale). This
// never generates or persists a plan by itself — it only returns
// suggestions.
//
// TODO (before deploying): rate-limit this route (PDF analysis calls cost
// money per request).
export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AdminAuthRequiredError) {
      return Response.json({ error: "Nicht als Coach angemeldet." }, { status: 401 });
    }
    throw err;
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "Keine Datei übermittelt." }, { status: 400 });
  }

  const mediaType = file.type || "application/pdf";
  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    const result = await analyzeScanDocument({ data: bytes, mediaType });
    return Response.json(result);
  } catch (err) {
    if (err instanceof AnalyzeScanConfigError) {
      // Not an error the coach caused — the feature just isn't set up in
      // this environment. 501 so the UI can distinguish "not configured"
      // from "the AI call itself failed" and fall back to manual entry.
      return Response.json({ error: err.message, configured: false }, { status: 501 });
    }
    console.error("[scans/analyze] failed", err);
    const message = err instanceof Error ? err.message : "Analyse fehlgeschlagen.";
    return Response.json({ error: message, configured: true }, { status: 502 });
  }
}
