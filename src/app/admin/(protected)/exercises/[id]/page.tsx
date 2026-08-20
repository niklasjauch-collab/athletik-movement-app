import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import ExerciseVideoForm from "./ExerciseVideoForm";

export const dynamic = "force-dynamic";

const PHASE_LABELS: Record<string, string> = {
  INHIBIT: "MoveFlexRelax",
  LENGTHEN: "MoveFlexStretch",
  ACTIVATE: "MoveSyncActivation",
  INTEGRATE: "MoveSyncIntegration",
};

// CoachAdmin briefing §37/§38 — an exercise's read-only content (name,
// tagging, coaching cues, etc. — all authored via the SmartMotionApproach
// production pipeline, see claude/SmartMotionApproach_Produktionsplan.md)
// plus the editable Video Management section.
export default async function ExerciseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const provider = await getActiveProvider();

  const exercise = await prisma.exercise.findFirst({
    where: { id, providerId: provider.id },
    include: { _count: { select: { planItems: true, correctivePlanItems: true } } },
  });
  if (!exercise) notFound();

  return (
    <main className="flex-1 px-6 py-10 max-w-3xl mx-auto pb-24">
      <p className="text-sm text-ink-700/50">
        <Link href="/admin/exercises" className="hover:underline">
          ← Übungen
        </Link>
      </p>
      <h1 className="mt-2 font-serif text-3xl font-bold text-ink-900">{exercise.name}</h1>
      <p className="mt-1 text-sm text-ink-700/70">
        {exercise.correctivePhase ? PHASE_LABELS[exercise.correctivePhase] ?? exercise.correctivePhase : "Keine Phase zugeordnet"}
        {" · verwendet in "}
        {exercise._count.planItems} Trainingsplan-Übung(en), {exercise._count.correctivePlanItems} Corrective-Plan-Slot(s)
      </p>

      {exercise.description && <p className="mt-4 text-sm text-ink-700/80">{exercise.description}</p>}

      <dl className="mt-6 grid gap-4 sm:grid-cols-2 text-sm">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-900/40">Körperregion</dt>
          <dd className="mt-1 text-ink-700">{exercise.muscleGroups.join(", ") || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-900/40">Equipment</dt>
          <dd className="mt-1 text-ink-700">{exercise.equipment.join(", ") || "Keins"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-900/40">Standard-Sätze</dt>
          <dd className="mt-1 text-ink-700">
            {exercise.sets.length > 0 ? `${exercise.sets.join(", ")} (${exercise.unit})` : "—"}
            {exercise.pauseSeconds > 0 ? ` · ${exercise.pauseSeconds}s Pause` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-900/40">Zielmuskeln</dt>
          <dd className="mt-1 text-ink-700">{exercise.targetMuscles.join(", ") || "—"}</dd>
        </div>
        {exercise.coachingCues.length > 0 && (
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-900/40">Coaching Cues</dt>
            <dd className="mt-1">
              <ul className="list-disc pl-4 text-ink-700">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
                {exercise.coachingCues.map((c: any) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </dd>
          </div>
        )}
      </dl>

      <section className="mt-10 rounded-xl border border-ink-900/10 p-5">
        <h2 className="font-semibold text-lg text-ink-900">Video</h2>
        <div className="mt-3">
          <ExerciseVideoForm
            exerciseId={exercise.id}
            initial={{
              videoMaleUrl: exercise.videoMaleUrl,
              videoFemaleUrl: exercise.videoFemaleUrl,
              videoThumbnailUrl: exercise.videoThumbnailUrl,
              isPublished: exercise.isPublished,
            }}
          />
        </div>
      </section>
    </main>
  );
}
