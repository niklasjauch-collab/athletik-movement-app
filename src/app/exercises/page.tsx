import Link from "next/link";
import { getBranding } from "@/lib/branding";
import exercisesData from "../../../prisma/seed-data/exercises.json";

// TODO (Phase 1 -> real data): replace this static import with a Prisma
// query for the current Provider's exercises
// (`prisma.exercise.findMany({ where: { providerId }, orderBy: { name: "asc" } })`)
// once the database is connected. Until then this reads directly from the
// migrated seed data (prisma/seed-data/exercises.json, 71 exercises), so
// the library is already browsable in the app.
//
// Video playback: videoMalePath/videoFemalePath are legacy BodyControl
// storage paths, not yet-hosted URLs (see README "Exercise library
// migration"). Once the video files are re-uploaded and seed.ts is run
// against a real database, swap these for the resulting
// videoMaleUrl/videoFemaleUrl and render an actual <video> player here.

type SeedExercise = {
  legacyId: string;
  name: string;
  description: string;
  language: string;
  muscleGroups: string[];
  equipment: string[];
  unit: string;
  pauseSeconds: number;
  sets: number[];
  intensity: string;
  notes: string | null;
  videoMalePath: string | null;
  videoFemalePath: string | null;
};

const exercises = exercisesData as SeedExercise[];

export default function ExercisesPage() {
  const branding = getBranding();

  return (
    <main className="flex-1 max-w-5xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-extrabold">Exercise library</h1>
      <p className="mt-2 text-slate-500">
        {exercises.length} exercises available in {branding.appName} to
        compose into training plans.
      </p>
      <p className="mt-1 text-sm text-slate-400">
        Exercises awaiting video production aren&apos;t shown here — see{" "}
        <Link href="/exercises/drafts" className="underline">
          /exercises/drafts
        </Link>
        .
      </p>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {exercises.map((exercise) => {
          const hasVideo = Boolean(
            exercise.videoMalePath || exercise.videoFemalePath
          );
          return (
            <li
              key={exercise.legacyId}
              className="rounded-xl border border-slate-200 p-6"
            >
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-semibold">{exercise.name}</h2>
                <span className="shrink-0 text-xs rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                  {exercise.unit}
                </span>
              </div>

              <p className="mt-2 text-sm text-slate-500 line-clamp-3">
                {exercise.description}
              </p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {exercise.muscleGroups.map((group) => (
                  <span
                    key={group}
                    className="text-xs rounded-full bg-brand-50 text-brand-700 px-2 py-1"
                  >
                    {group}
                  </span>
                ))}
                {exercise.equipment.map((item) => (
                  <span
                    key={item}
                    className="text-xs rounded-full bg-slate-50 text-slate-500 px-2 py-1"
                  >
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                <span>
                  {exercise.sets.length > 0
                    ? `${exercise.sets.length} sets: ${exercise.sets.join(", ")}`
                    : "no sets recorded"}
                  {exercise.pauseSeconds > 0
                    ? ` · ${exercise.pauseSeconds}s rest`
                    : ""}
                </span>
                <span
                  className={
                    hasVideo ? "text-brand-600" : "text-amber-600"
                  }
                >
                  {hasVideo ? "video pending migration" : "no video"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
