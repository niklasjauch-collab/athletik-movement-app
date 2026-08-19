// Decides whether a scan's findings fit into ONE corrective exercise plan
// or need to be split into TWO complete plans, and builds each with
// generatePlan.ts. See the CorrectivePlan model's doc comment in
// schema.prisma for the product rationale: overloading a client with
// every finding from a scan in a single session (potentially covering
// every phase for 8+ compensations) isn't realistic to actually complete,
// so past a threshold we produce two independently complete Inhibit->
// Integrate sessions ("Plan A — Schwerpunkt" / "Plan B — Ergänzend") meant
// to be alternated across the week instead.
//
// This is the module the automatic scan-upload pipeline
// (src/app/api/clients/[id]/scans/route.ts) calls — it's what makes the
// "1 oder bei vielen Kompensationen 2 individuelle Pläne, ohne dass ich
// weitere Schritte machen muss" requirement concrete.

import { generatePlan, FindingInput, ExerciseCandidate, GeneratedPlan } from "./generatePlan";

export type Severity = "MILD" | "MODERATE" | "SEVERE";

export interface SplitFindingInput extends FindingInput {
  /** From the source report when available (e.g. the SmartMotionScan
   * device's own MILD/MÄSSIG/SCHWER rating, or a manually-tagged
   * severity). Missing/null severity is treated as MODERATE for the
   * purposes of ranking — a finding without a stated severity shouldn't
   * automatically be treated as trivial. */
  severity?: Severity | null;
}

export interface SessionPlan {
  /** null when there's only one plan for this scan (the common case). */
  label: string | null;
  priorityRank: number | null;
  plan: GeneratedPlan;
  /** Which findings went into this specific plan — kept for persistence
   * (CorrectivePlanItem.sourceCompensations already covers per-item
   * traceability, but this is useful for logging/debugging the split
   * decision itself). */
  findings: SplitFindingInput[];
}

// More than this many distinct findings on one scan is considered too
// much for a single session — see the doc comment above. Chosen so a
// "normal" scan (2-4 compensations, the common case per the NASM OHSA
// checklist) always gets one plan, while a report as dense as the
// Susanna Dulkinys example (7 mappable findings, see
// README "Automatischer Scan-zu-Plan-Workflow") reliably splits.
const SPLIT_THRESHOLD = 5;

const SEVERITY_WEIGHT: Record<Severity, number> = { SEVERE: 3, MODERATE: 2, MILD: 1 };

function weightOf(f: SplitFindingInput): number {
  return f.severity ? SEVERITY_WEIGHT[f.severity] : SEVERITY_WEIGHT.MODERATE;
}

export function splitIntoSessions(findings: SplitFindingInput[], exercises: ExerciseCandidate[]): SessionPlan[] {
  if (findings.length === 0) return [];

  if (findings.length <= SPLIT_THRESHOLD) {
    return [{ label: null, priorityRank: null, plan: generatePlan(findings, exercises), findings }];
  }

  // Rank by severity (SEVERE first), preserving original order for ties
  // so the split is deterministic given the same input.
  const ranked = findings
    .map((f, index) => ({ f, index }))
    .sort((a, b) => weightOf(b.f) - weightOf(a.f) || a.index - b.index);

  const splitAt = Math.ceil(ranked.length / 2);
  const groupA = ranked.slice(0, splitAt).map((r) => r.f);
  const groupB = ranked.slice(splitAt).map((r) => r.f);

  return [
    { label: "Plan A — Schwerpunkt", priorityRank: 1, plan: generatePlan(groupA, exercises), findings: groupA },
    { label: "Plan B — Ergänzend", priorityRank: 2, plan: generatePlan(groupB, exercises), findings: groupB },
  ];
}
