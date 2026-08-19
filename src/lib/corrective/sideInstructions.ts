// Renders client-specific, side-aware instruction text for one
// CorrectivePlanItem/PlanItem, WITHOUT ever rewriting the shared
// Exercise.description/execution text in the database. The library entry
// for e.g. "Resisted Ankle Inversion mit Miniband" stays generic and
// reusable across every client; this module composes the one-off,
// per-plan sentence that says "nur rechts" or "beidseitig" from the
// exercise's own dosage fields plus the Side the plan generator derived
// for that slot (see generatePlan.ts's mergeSide()).
//
// Rationale for this split (composition at render time, not text
// rewriting) instead of e.g. a find/replace over free-text exercise
// descriptions: the 70+ migrated exercises' German descriptions were
// never written with {SIDE} placeholders, so pattern-matching bilateral
// phrasing ("pro Seite", "wechsle die Seite", ...) out of free text would
// be fragile and could silently produce wrong instructions. Composing a
// short, unambiguous instruction from structured data (sets/unit/side) is
// slower to write per-exercise but never wrong.

import type { Side } from "./generatePlan";

export interface DosageInfo {
  sets: number[];
  unit: string; // e.g. "Sekunden" | "Körpergewicht" | "Wiederholungen"
  pauseSeconds?: number | null;
  dosageNote?: string | null; // free-text override, e.g. "2-3 Sätze à 8-10 Wiederholungen pro Seite"
}

/** Short German label for a badge/UI chip. */
export function sideLabel(side: Side): string {
  switch (side) {
    case "LEFT":
      return "nur links";
    case "RIGHT":
      return "nur rechts";
    default:
      return "beidseitig";
  }
}

/**
 * A one-sentence, client-facing note explaining the side restriction.
 * Returns null for BILATERAL — no special note needed, the exercise's own
 * dosage text already implies both sides.
 *
 * `reasonLabel`, when given (typically the German label of the OHSA
 * compensation that drove this slot, e.g. "Füße drehen nach außen"), is
 * folded into the sentence so the client/coach understands *why* only one
 * side is prescribed, not just that it is.
 */
export function renderSideNote(side: Side, reasonLabel?: string | null): string | null {
  if (side === "BILATERAL") return null;
  const seite = side === "LEFT" ? "links" : "rechts";
  const gegenseite = side === "LEFT" ? "rechts" : "links";
  const because = reasonLabel ? ` (Befund: „${reasonLabel}“, nur ${seite})` : "";
  return `Nur ${seite} durchführen${because} — die ${gegenseite === "links" ? "linke" : "rechte"} Seite zeigte hier keine Auffälligkeit und muss nicht mittrainiert werden.`;
}

/**
 * Human-readable dosage line. Prefers the exercise's own free-text
 * dosageNote (already phase/exercise-appropriate) when present; falls
 * back to composing one from sets/unit. Side is NOT baked into this
 * string — pair it with renderSideNote() for the side-specific caveat, so
 * a coach reading the plan sees "3 Sätze à 12 Wiederholungen" and,
 * separately, "Nur rechts durchführen" rather than one run-on sentence
 * that's easy to misread.
 */
export function renderDosageText(dosage: DosageInfo): string {
  if (dosage.dosageNote && dosage.dosageNote.trim()) return dosage.dosageNote.trim();
  if (!dosage.sets || dosage.sets.length === 0) return "Dosierung noch nicht hinterlegt.";
  const allSame = dosage.sets.every((s) => s === dosage.sets[0]);
  const setsText = allSame
    ? `${dosage.sets.length} Sätze à ${dosage.sets[0]} ${dosage.unit}`
    : `${dosage.sets.length} Sätze (${dosage.sets.join(", ")} ${dosage.unit})`;
  const pause = dosage.pauseSeconds ? ` · ${dosage.pauseSeconds}s Pause` : "";
  return `${setsText}${pause}`;
}

/** Convenience bundle for UI rendering — one call, everything needed. */
export function renderPlanItemInstruction(dosage: DosageInfo, side: Side, reasonLabel?: string | null) {
  return {
    side,
    sideLabel: sideLabel(side),
    dosageText: renderDosageText(dosage),
    sideNote: renderSideNote(side, reasonLabel),
  };
}
