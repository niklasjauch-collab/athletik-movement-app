// Shared read-only rendering of one CorrectivePlan (phases -> exercises,
// side-aware instructions) — used by both the client-facing /portal and
// the coach-facing /clients/[id] pages so the two views never drift out
// of sync with each other.
import { renderPlanItemInstruction } from "@/lib/corrective/sideInstructions";
import type { Side } from "@/lib/corrective/generatePlan";
import type { Phase } from "@/lib/corrective/rules";

const PHASE_LABELS: Record<Phase, string> = {
  INHIBIT: "1. Inhibit — Faszien lösen",
  LENGTHEN: "2. Lengthen — Dehnen",
  ACTIVATE: "3. Activate — Aktivieren",
  INTEGRATE: "4. Integrate — Integrieren",
};
export const PHASE_ORDER: Phase[] = ["INHIBIT", "LENGTHEN", "ACTIVATE", "INTEGRATE"];

export interface PlanCardItem {
  id: string;
  phase: Phase;
  order: number;
  targetMuscle: string;
  side: Side;
  exercise: {
    id: string;
    name: string;
    description: string | null;
    sets: number[];
    unit: string;
    pauseSeconds: number;
    dosageNote: string | null;
  };
}

export interface PlanCardData {
  id: string;
  label: string | null;
  items: PlanCardItem[];
}

export function CorrectivePlanCard({ plan, compact = false }: { plan: PlanCardData; compact?: boolean }) {
  const byPhase = new Map<Phase, PlanCardItem[]>();
  for (const item of plan.items) {
    if (!byPhase.has(item.phase)) byPhase.set(item.phase, []);
    byPhase.get(item.phase)!.push(item);
  }

  return (
    <section className={compact ? "" : "rounded-xl border border-slate-200 p-6"}>
      {plan.label && !compact && <h2 className="text-lg font-bold text-ink-900">{plan.label}</h2>}
      <div className="flex flex-col gap-6">
        {PHASE_ORDER.filter((phase) => byPhase.has(phase)).map((phase) => (
          <div key={phase}>
            <h3 className="text-sm font-semibold text-slate-600">{PHASE_LABELS[phase]}</h3>
            <ul className="mt-2 flex flex-col gap-3">
              {byPhase.get(phase)!.map((item) => {
                const instruction = renderPlanItemInstruction(
                  {
                    sets: item.exercise.sets,
                    unit: item.exercise.unit,
                    pauseSeconds: item.exercise.pauseSeconds,
                    dosageNote: item.exercise.dosageNote,
                  },
                  item.side
                );
                return (
                  <li key={item.id} className="rounded-lg bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm text-ink-900">{item.exercise.name}</p>
                      {instruction.side !== "BILATERAL" && (
                        <span className="text-[11px] rounded-full bg-brand-100 text-brand-700 px-2 py-0.5 shrink-0">
                          {instruction.sideLabel}
                        </span>
                      )}
                    </div>
                    {item.exercise.description && (
                      <p className="mt-1 text-xs text-slate-500">{item.exercise.description}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-600">{instruction.dosageText}</p>
                    {instruction.sideNote && <p className="mt-1 text-xs text-amber-700">{instruction.sideNote}</p>}
                    <p className="mt-1 text-[11px] text-slate-400">Ziel: {item.targetMuscle}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
