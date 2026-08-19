import draftExercisesData from "../../../../prisma/seed-data/draft-exercises.json";

// TODO (Phase 1 -> real data): replace with a Prisma query
// (`prisma.exercise.findMany({ where: { providerId, isPublished: false }, orderBy: [{ productionRound: "asc" }] })`)
// once the database is connected.
//
// Internal/coach-only view of the SmartMotionApproach production
// pipeline: exercises that are fully specified (all 20 fields from the
// production spec) but not yet shown to clients because no video has
// been filmed yet. See claude/SmartMotionApproach_Produktionsplan.md in
// the project for the full plan across all 15 production rounds.
//
// TODO before going further than Phase 1: put this behind coach auth —
// it currently has no access control, same as the rest of this scaffold.

type DraftExercise = {
  legacyId: string | null;
  name: string;
  nameEn?: string | null;
  description: string | null;
  muscleGroups: string[];
  equipment: string[];
  unit: string;
  pauseSeconds: number;
  sets: number[];
  correctivePhase?: string | null;
  targetMuscles?: string[];
  bibCategory?: string | null;
  level?: string | null;
  productionRound?: number | null;
  relevantSigns?: string[];
  relevantSignClusters?: string[];
  relevantSubsystems?: string[];
  rationale?: string | null;
  startPosition?: string | null;
  execution?: string | null;
  coachingCues?: string[];
  commonMistakes?: string[];
  dosageNote?: string | null;
  regressionNote?: string | null;
  progressionNote?: string | null;
  contraindicationNote?: string | null;
  similarExistingName?: string | null;
  similarExistingDifference?: string | null;
};

const drafts = draftExercisesData as DraftExercise[];

const PHASE_LABELS: Record<string, string> = {
  INHIBIT: "MoveFlexRelax",
  LENGTHEN: "MoveFlexStretch",
  ACTIVATE: "MoveSyncActivation",
  INTEGRATE: "MoveSyncIntegration",
};

const BIB_CATEGORY_LABELS: Record<string, string> = {
  BI_ORIGINAL: "BI Original",
  BI_BASED: "BI Based",
  SMA_BASED: "SMA Based",
};

const BIB_CATEGORY_STYLES: Record<string, string> = {
  BI_ORIGINAL: "bg-emerald-50 text-emerald-700",
  BI_BASED: "bg-brand-50 text-brand-700",
  SMA_BASED: "bg-indigo-50 text-indigo-700",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm text-slate-700">{children}</dd>
    </div>
  );
}

export default function DraftExercisesPage() {
  const rounds = Array.from(new Set(drafts.map((d) => d.productionRound ?? 0))).sort((a, b) => a - b);

  return (
    <main className="flex-1 max-w-4xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-extrabold">SmartMotionApproach — Produktions-Pipeline</h1>
      <p className="mt-2 text-slate-500">
        {drafts.length} vollständig spezifizierte Übungen, die noch auf ihre
        Video-Produktion warten. Diese Seite ist intern — die Übungen sind
        NICHT im öffentlichen <code>/exercises</code>-Verzeichnis sichtbar
        und werden vom Corrective-Plan-Generator nicht als Kandidaten
        verwendet, solange <code>isPublished: false</code> ist.
      </p>

      {rounds.map((round) => (
        <section key={round} className="mt-10">
          <h2 className="text-lg font-bold text-slate-800">
            Produktionsrunde {round}
          </h2>
          <div className="mt-4 flex flex-col gap-6">
            {drafts
              .filter((d) => (d.productionRound ?? 0) === round)
              .map((ex) => (
                <article key={ex.name} className="rounded-xl border border-amber-200 bg-amber-50/40 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-slate-900">{ex.name}</h3>
                      {ex.nameEn && <p className="text-sm text-slate-500 italic">{ex.nameEn}</p>}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-xs rounded-full bg-amber-100 text-amber-800 px-2 py-1 font-medium">
                        Draft — kein Video
                      </span>
                      {ex.bibCategory && (
                        <span
                          className={`text-xs rounded-full px-2 py-1 font-medium ${
                            BIB_CATEGORY_STYLES[ex.bibCategory] ?? "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {BIB_CATEGORY_LABELS[ex.bibCategory] ?? ex.bibCategory}
                        </span>
                      )}
                      {ex.correctivePhase && (
                        <span className="text-xs rounded-full bg-slate-100 text-slate-600 px-2 py-1">
                          {PHASE_LABELS[ex.correctivePhase] ?? ex.correctivePhase} · {ex.level === "LEVEL_1" ? "Level 1" : "Level 2"}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-slate-600">{ex.description}</p>

                  <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="Zielmuskel / Zielfunktion">
                      {ex.targetMuscles && ex.targetMuscles.length > 0 ? ex.targetMuscles.join(", ") : "—"}
                    </Field>
                    <Field label="Relevante OHS-Signs">{ex.relevantSigns?.join(", ") || "—"}</Field>
                    <Field label="Sign Cluster">{ex.relevantSignClusters?.join(", ") || "—"}</Field>
                    <Field label="Subsystem">{ex.relevantSubsystems?.join(", ") || "—"}</Field>
                    <Field label="Equipment">{ex.equipment.join(", ") || "Keins"}</Field>
                    <Field label="Dosierung">{ex.dosageNote}</Field>
                  </dl>

                  <div className="mt-4">
                    <Field label="Warum benötigt">{ex.rationale}</Field>
                  </div>
                  <div className="mt-4">
                    <Field label="Ausgangsposition">{ex.startPosition}</Field>
                  </div>
                  <div className="mt-4">
                    <Field label="Durchführung">{ex.execution}</Field>
                  </div>

                  <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="Coaching Cues">
                      <ul className="list-disc pl-4">
                        {ex.coachingCues?.map((cue) => <li key={cue}>{cue}</li>)}
                      </ul>
                    </Field>
                    <Field label="Häufigste Fehler">
                      <ul className="list-disc pl-4">
                        {ex.commonMistakes?.map((m) => <li key={m}>{m}</li>)}
                      </ul>
                    </Field>
                    <Field label="Regression">{ex.regressionNote}</Field>
                    <Field label="Progression">{ex.progressionNote}</Field>
                    <Field label="Wann nicht sinnvoll">{ex.contraindicationNote}</Field>
                    <Field label="Ähnliche vorhandene Übung">
                      {ex.similarExistingName && (
                        <>
                          <span className="font-medium">{ex.similarExistingName}</span>
                          {ex.similarExistingDifference && (
                            <span className="block text-slate-500 mt-1">{ex.similarExistingDifference}</span>
                          )}
                        </>
                      )}
                    </Field>
                  </dl>
                </article>
              ))}
          </div>
        </section>
      ))}
    </main>
  );
}
