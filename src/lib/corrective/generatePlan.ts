// Turns a list of recorded OHSA-style compensations (from a reviewed
// SmartMotionScan report) into an ordered Inhibit -> Lengthen -> Activate
// -> Integrate corrective exercise plan, using the reference data in
// rules.ts. Pure function, no DB/Prisma dependency, so it's easy to unit
// test (see generatePlan.test.ts) and reusable from an API route, a
// server action, or a script.

import { COMPENSATION_RULES, CompensationKey, Phase } from "./rules";

export type Side = "LEFT" | "RIGHT" | "BILATERAL";

export interface FindingInput {
  compensation: CompensationKey;
  side: Side;
}

/** The subset of Exercise fields the generator needs to pick candidates. */
export interface ExerciseCandidate {
  id: string;
  name: string;
  correctivePhase: Phase | null;
  targetMuscles: string[];
  /** "manual" | "verified" tags are preferred over "auto" when several
   * exercises could fill the same slot. */
  taggingSource?: string | null;
}

export interface PlanItem {
  phase: Phase;
  order: number;
  exerciseId: string;
  exerciseName: string;
  /** Muscle(s)/target this exercise was selected to address in this slot. */
  targetMuscles: string[];
  sourceCompensations: CompensationKey[];
  /** Which side this slot actually needs to be trained on. Derived from
   * the finding(s) that drove this exercise: LEFT/RIGHT only when EVERY
   * contributing finding was unilateral on that same side; BILATERAL
   * otherwise (mixed sides, or a finding recorded as BILATERAL). See
   * mergeSide() below. This is what src/lib/corrective/sideInstructions.ts
   * uses to render a client-facing instruction that says "nur links"/
   * "nur rechts" instead of a generic bilateral one — the exercise's own
   * description text is never rewritten, only the plan-item instruction. */
  side: Side;
}

export interface GeneratedPlan {
  items: PlanItem[];
  /** Muscles (or, for Integrate, suggested movement patterns) the rule
   * engine wanted to address but no matching exercise existed for —
   * surfaced so the coach knows where the library still has gaps. */
  gaps: Partial<Record<Phase, string[]>>;
}

const ORDERED_MUSCLE_PHASES = ["INHIBIT", "LENGTHEN", "ACTIVATE"] as const;

function scoreCandidate(e: ExerciseCandidate): number {
  // Prefer manually verified tags over auto-tagged ones when multiple
  // exercises could fill the same slot.
  if (e.taggingSource === "verified") return 2;
  if (e.taggingSource === "manual") return 1;
  return 0;
}

/** Collapse a set of contributing finding-sides into the single Side a
 * plan item should carry: unanimous LEFT -> LEFT, unanimous RIGHT ->
 * RIGHT, anything else (mixed, empty, or BILATERAL involved) -> BILATERAL.
 * Defaulting to BILATERAL on any ambiguity is the safe choice — it means
 * "train both sides", never silently drops a side that might need work. */
function mergeSide(sides: Iterable<Side>): Side {
  const set = new Set(sides);
  if (set.size === 1) {
    const only = [...set][0];
    if (only === "LEFT" || only === "RIGHT") return only;
  }
  return "BILATERAL";
}

export function generatePlan(
  findings: FindingInput[],
  exercises: ExerciseCandidate[]
): GeneratedPlan {
  // 1. Collect muscle targets per phase across all findings, tracking
  // which compensation(s) AND which side(s) drove each muscle so the plan
  // stays explainable to the coach and side-aware.
  type MuscleSource = { comps: Set<CompensationKey>; sides: Set<Side> };
  const muscleSources: Record<(typeof ORDERED_MUSCLE_PHASES)[number], Map<string, MuscleSource>> = {
    INHIBIT: new Map(),
    LENGTHEN: new Map(),
    ACTIVATE: new Map(),
  };
  const integrateSuggestions = new Map<string, MuscleSource>();

  for (const finding of findings) {
    const rule = COMPENSATION_RULES[finding.compensation];
    if (!rule) continue; // unknown compensation key — ignore rather than throw

    for (const phase of ORDERED_MUSCLE_PHASES) {
      for (const muscle of rule.phases[phase]) {
        if (!muscleSources[phase].has(muscle)) {
          muscleSources[phase].set(muscle, { comps: new Set(), sides: new Set() });
        }
        const src = muscleSources[phase].get(muscle)!;
        src.comps.add(finding.compensation);
        src.sides.add(finding.side);
      }
    }
    for (const suggestion of rule.integrateSuggestions) {
      if (!integrateSuggestions.has(suggestion)) {
        integrateSuggestions.set(suggestion, { comps: new Set(), sides: new Set() });
      }
      const src = integrateSuggestions.get(suggestion)!;
      src.comps.add(finding.compensation);
      src.sides.add(finding.side);
    }
  }

  const items: PlanItem[] = [];
  const gaps: Partial<Record<Phase, string[]>> = {};
  let order = 0;

  // 2. For Inhibit/Lengthen/Activate: pick one exercise per muscle,
  // deduplicating when the same exercise happens to cover several
  // muscles in the same phase (common — e.g. one calf stretch covers
  // both Gastrocnemius and Soleus). When two muscles that merge into the
  // same exercise came from different sides, the merged item falls back
  // to BILATERAL (see mergeSide) — safer than silently picking one side.
  for (const phase of ORDERED_MUSCLE_PHASES) {
    const pickedByExerciseId = new Map<string, PlanItem & { _sides: Set<Side> }>();
    const missing: string[] = [];

    for (const [muscle, src] of muscleSources[phase]) {
      const candidates = exercises
        .filter((e) => e.correctivePhase === phase && e.targetMuscles.includes(muscle))
        .sort((a, b) => scoreCandidate(b) - scoreCandidate(a));
      const best = candidates[0];

      if (!best) {
        missing.push(muscle);
        continue;
      }

      const existing = pickedByExerciseId.get(best.id);
      if (existing) {
        if (!existing.targetMuscles.includes(muscle)) existing.targetMuscles.push(muscle);
        for (const c of src.comps) if (!existing.sourceCompensations.includes(c)) existing.sourceCompensations.push(c);
        for (const s of src.sides) existing._sides.add(s);
      } else {
        const item: PlanItem & { _sides: Set<Side> } = {
          phase,
          order: order++,
          exerciseId: best.id,
          exerciseName: best.name,
          targetMuscles: [muscle],
          sourceCompensations: [...src.comps],
          side: "BILATERAL", // finalized below once all muscles are merged in
          _sides: new Set(src.sides),
        };
        pickedByExerciseId.set(best.id, item);
        items.push(item);
      }
    }

    for (const item of pickedByExerciseId.values()) {
      item.side = mergeSide(item._sides);
    }

    if (missing.length) gaps[phase] = missing;
  }

  // 3. Integrate: NASM's integration exercises are compound/functional
  // movements, not single-muscle targets, so match by keyword overlap
  // between the suggested movement name (e.g. "Single-leg squat") and
  // the exercise's own name instead.
  const missingIntegrate: string[] = [];
  const pickedIntegrateIds = new Set<string>();

  for (const [suggestion, src] of integrateSuggestions) {
    const keywords = suggestion
      .toLowerCase()
      .split(/[\s/-]+/)
      .filter((w) => w.length > 3 && !["with", "mit", "und", "and"].includes(w));

    const candidates = exercises
      .filter((e) => e.correctivePhase === "INTEGRATE")
      .filter((e) => {
        const nameL = e.name.toLowerCase();
        return keywords.some((k) => nameL.includes(k));
      })
      .sort((a, b) => scoreCandidate(b) - scoreCandidate(a));

    const best = candidates.find((c) => !pickedIntegrateIds.has(c.id)) ?? candidates[0];

    if (!best) {
      missingIntegrate.push(suggestion);
      continue;
    }
    pickedIntegrateIds.add(best.id);
    items.push({
      phase: "INTEGRATE",
      order: order++,
      exerciseId: best.id,
      exerciseName: best.name,
      targetMuscles: [suggestion],
      sourceCompensations: [...src.comps],
      side: mergeSide(src.sides),
    });
  }
  if (missingIntegrate.length) gaps.INTEGRATE = missingIntegrate;

  // Strip the internal _sides bookkeeping field before returning.
  return { items: items.map(({ phase, order, exerciseId, exerciseName, targetMuscles, sourceCompensations, side }) => ({ phase, order, exerciseId, exerciseName, targetMuscles, sourceCompensations, side })), gaps };
}
