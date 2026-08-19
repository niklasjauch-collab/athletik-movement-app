import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { analyzeScanDocument, AnalyzeScanConfigError } from "@/lib/corrective/analyzeScan";
import { splitIntoSessions, SplitFindingInput } from "@/lib/corrective/splitIntoSessions";
import type { ExerciseCandidate } from "@/lib/corrective/generatePlan";

// THE automatic scan -> plan pipeline: the coach uploads a SmartMotionScan
// report for a specific client here, and — with zero further steps —
// this route reads it with analyzeScan.ts, records the findings it
// proposes, and generates 1 (or 2, via splitIntoSessions.ts) complete
// CorrectivePlan(s) from them. This is the "ohne dass ich weitere
// Schritte machen muss" requirement: unlike /api/scans/analyze (the older
// /scans demo flow, which returns suggestions for a coach to review in a
// checklist before generating anything), this route commits AI-proposed
// findings straight to the database and generates the plan in the same
// request.
//
// Because there's no manual review step, this only works when
// ANTHROPIC_API_KEY/ANTHROPIC_MODEL are configured (see analyzeScan.ts) —
// if they're not, the scan is still stored and the response says so
// clearly, rather than silently doing nothing. See README "Automatischer
// Scan-zu-Plan-Workflow" for the health-data/DSGVO note that applies here
// too (same as /api/scans/analyze).
//
// TODO (before deploying to Vercel/production): same local-filesystem
// caveat as src/app/api/scans/upload/route.ts — swap for real object
// storage before going live. TODO (coach auth): this route has no
// authentication yet — see README "Auth" for the current single-operator
// assumption.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Keine Datei übermittelt." }, { status: 400 });
  }

  const provider = await getActiveProvider();
  const client = await prisma.client.findFirst({ where: { id: clientId, providerId: provider.id } });
  if (!client) {
    return Response.json({ error: "Kunde nicht gefunden." }, { status: 404 });
  }

  // 1. Store the uploaded file and create the MovementScan row up front —
  // even if the automatic analysis below fails or isn't configured, the
  // report itself must not be lost.
  const uploadsDir = path.join(process.cwd(), ".uploads", "scans");
  await mkdir(uploadsDir, { recursive: true });
  const safeExt = path.extname(file.name).slice(0, 10);
  const storedName = `${randomUUID()}${safeExt}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadsDir, storedName), bytes);

  const scan = await prisma.movementScan.create({
    data: {
      providerId: provider.id,
      clientId: client.id,
      fileUrl: `/.uploads/scans/${storedName}`,
      fileName: file.name,
      contentType: file.type || null,
    },
  });

  // 2. Automatic AI analysis — proposes findings straight from the report.
  const mediaType = file.type || "application/pdf";
  let analysis;
  try {
    analysis = await analyzeScanDocument({ data: bytes, mediaType });
  } catch (err) {
    if (err instanceof AnalyzeScanConfigError) {
      return Response.json(
        {
          ok: true,
          scanId: scan.id,
          plansGenerated: 0,
          message:
            "Scan gespeichert, aber die automatische Analyse ist nicht konfiguriert (ANTHROPIC_API_KEY fehlt) — es konnte kein Plan automatisch erstellt werden. Befunde können über /scans manuell erfasst werden.",
        },
        { status: 200 }
      );
    }
    console.error("[clients/scans] analysis failed", err);
    return Response.json(
      {
        ok: true,
        scanId: scan.id,
        plansGenerated: 0,
        message: "Scan gespeichert, aber die automatische Analyse ist fehlgeschlagen. Bitte Befunde manuell über /scans erfassen.",
      },
      { status: 200 }
    );
  }

  if (analysis.unreadable || analysis.findings.length === 0) {
    return Response.json({
      ok: true,
      scanId: scan.id,
      plansGenerated: 0,
      message: analysis.unreadable
        ? "Die Datei konnte nicht als Bewegungsassessment gelesen werden. Bitte Befunde manuell über /scans erfassen."
        : "Die Analyse hat keine auffälligen Kompensationen gefunden — es wurde kein Plan erstellt.",
      summary: analysis.summary,
    });
  }

  // 3. Persist the AI-proposed findings. (Note: analyzeScanDocument only
  // ever proposes findings the report actually documents — see its
  // SYSTEM_PROMPT — so committing them directly here, without a manual
  // review step, is the intended zero-step behavior for this route.)
  await prisma.movementFinding.createMany({
    data: analysis.findings.map((f) => ({
      movementScanId: scan.id,
      compensation: f.compensation,
      side: f.side,
      severity: f.severity ?? null,
    })),
    skipDuplicates: true, // same @@unique([movementScanId, compensation, side]) as MovementFinding
  });

  await prisma.movementScan.update({ where: { id: scan.id }, data: { status: "FINDINGS_ENTERED" } });

  // 4. Generate the plan(s). Candidate pool = published, corrective-tagged
  // exercises for this provider (matches /scans' manual flow).
  const exerciseRows = await prisma.exercise.findMany({
    where: { providerId: provider.id, isPublished: true, correctivePhase: { not: null } },
    select: { id: true, name: true, correctivePhase: true, targetMuscles: true, taggingSource: true },
  });
  const exercises: ExerciseCandidate[] = exerciseRows;

  const splitFindings: SplitFindingInput[] = analysis.findings.map((f) => ({
    compensation: f.compensation,
    side: f.side,
    severity: f.severity ?? null,
  }));

  const sessionPlans = splitIntoSessions(splitFindings, exercises);

  const createdPlans = [];
  for (const sp of sessionPlans) {
    const plan = await prisma.correctivePlan.create({
      data: {
        providerId: provider.id,
        clientId: client.id,
        movementScanId: scan.id,
        label: sp.label,
        priorityRank: sp.priorityRank,
        items: {
          create: sp.plan.items.map((item) => ({
            exerciseId: item.exerciseId,
            phase: item.phase,
            order: item.order,
            targetMuscle: item.targetMuscles.join(", "),
            sourceCompensations: item.sourceCompensations,
            side: item.side,
          })),
        },
      },
      include: { items: true },
    });
    createdPlans.push(plan);
  }

  await prisma.movementScan.update({ where: { id: scan.id }, data: { status: "PLAN_GENERATED" } });

  return Response.json({
    ok: true,
    scanId: scan.id,
    plansGenerated: createdPlans.length,
    plans: createdPlans.map((p) => ({ id: p.id, label: p.label, itemCount: p.items.length })),
    findingsCount: analysis.findings.length,
    summary: analysis.summary,
  });
}
