"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { renderPlanItemInstruction } from "@/lib/corrective/sideInstructions";
import {
  createSessionFromPlan,
  getLatestPlan,
  getSession,
  listSessions,
  PostQuestionnaire,
  PreQuestionnaire,
  saveSession,
  SessionExerciseLog,
  TrainingSessionRecord,
} from "@/lib/trainingLog";
import exercisesData from "../../../../../prisma/seed-data/exercises.json";
import correctiveExercisesData from "../../../../../prisma/seed-data/corrective-exercises.json";
import { PHASE_LABELS, SMART_MOTION_APPROACH_LABELS, Phase } from "@/lib/corrective/rules";

// TODO (Phase 1 -> real data): replace with a Prisma query, same as /scans.
const placeholderClients = [
  { id: "demo-client-1", name: "Anna Beispiel" },
  { id: "demo-client-2", name: "Tom Muster" },
];

type SeedExercise = {
  legacyId: string | null;
  name: string;
  sets: number[];
  unit: string;
  pauseSeconds: number;
  dosageNote?: string | null;
};

const allExercises = [
  ...(exercisesData as SeedExercise[]),
  ...(correctiveExercisesData as SeedExercise[]),
];
const exerciseById = new Map<string, SeedExercise>(
  allExercises.map((e, i) => [e.legacyId ?? `generic-${i}`, e])
);

function parseSetsInput(raw: string): number[] {
  return raw
    .split(/[,;\s]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n) && n >= 0);
}

function ScaleInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">
        {label} {value != null && <span className="text-slate-400 font-normal">({value}/10)</span>}
      </label>
      <input
        type="range"
        min={0}
        max={10}
        value={value ?? 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full"
      />
    </div>
  );
}

// Reads localStorage synchronously to decide what this mount should show:
// the requested session, an existing in-progress one, or a freshly-created
// one from the client's latest generated plan. Called once from a useState
// lazy initializer (see TrainingPageInner) rather than an effect, since
// creating a session is a write that must happen exactly once per identity
// — the lazy-initializer form guarantees that the way an effect body
// doesn't. TrainingPageRouter below remounts TrainingPageInner (via `key`)
// whenever clientId/sessionId change, so this naturally re-runs for a new
// identity without any manual "reset" state juggling.
function loadInitialSession(
  clientId: string,
  sessionIdParam: string | null
): { session: TrainingSessionRecord | null; error: string | null; canonicalSessionId: string | null } {
  if (sessionIdParam) {
    const found = getSession(clientId, sessionIdParam);
    if (found) return { session: found, error: null, canonicalSessionId: null };
    return {
      session: null,
      error: "Sitzung wurde nicht gefunden (evtl. anderes Gerät/Browser als beim Erstellen).",
      canonicalSessionId: null,
    };
  }

  // No sessionId given: resume the most recent PLANNED session, or start a
  // fresh one from the client's latest generated plan.
  const existingPlanned = listSessions(clientId).find((s) => s.status === "PLANNED");
  if (existingPlanned) return { session: existingPlanned, error: null, canonicalSessionId: existingPlanned.id };

  const plan = getLatestPlan(clientId);
  if (plan) {
    const created = createSessionFromPlan(clientId, plan);
    return { session: created, error: null, canonicalSessionId: created.id };
  }

  return { session: null, error: null, canonicalSessionId: null };
}

function TrainingPageInner({ clientId, sessionIdParam }: { clientId: string; sessionIdParam: string | null }) {
  const router = useRouter();
  const [initial] = useState(() => loadInitialSession(clientId, sessionIdParam));
  const [session, setSession] = useState<TrainingSessionRecord | null>(initial.session);
  const [saved, setSaved] = useState(false);
  const error = initial.error;

  // Canonicalize the URL to include ?sessionId= once, so reloading/sharing
  // the link resumes the same session. Pure navigation, no setState here.
  useEffect(() => {
    if (initial.canonicalSessionId) {
      router.replace(`/training?clientId=${clientId}&sessionId=${initial.canonicalSessionId}`);
    }
    // Runs once per mount; this component remounts (via `key`) whenever
    // clientId/sessionIdParam change, so no dependency array churn needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updatePre(patch: Partial<PreQuestionnaire>) {
    setSession((s) => (s ? { ...s, pre: { ...(s.pre ?? {}), ...patch } } : s));
  }
  function updatePost(patch: Partial<PostQuestionnaire>) {
    setSession((s) => (s ? { ...s, post: { ...(s.post ?? {}), ...patch } } : s));
  }
  function updateExercise(index: number, patch: Partial<SessionExerciseLog>) {
    setSession((s) => {
      if (!s) return s;
      const exercises = s.exercises.map((ex, i) => (i === index ? { ...ex, ...patch } : ex));
      return { ...s, exercises };
    });
  }

  function handleSaveProgress() {
    if (!session) return;
    saveSession(session);
    setSaved(true);
  }

  function handleCompleteSession() {
    if (!session) return;
    const completed: TrainingSessionRecord = {
      ...session,
      status: "COMPLETED",
      completedAt: new Date().toISOString(),
    };
    saveSession(completed);
    setSession(completed);
    setSaved(true);
  }

  if (!session) {
    return (
      <main className="flex-1 max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-extrabold">Trainingsdokumentation</h1>
        {error ? (
          <p className="mt-4 text-sm text-red-600">{error}</p>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            Für {placeholderClients.find((c) => c.id === clientId)?.name ?? clientId} liegt noch kein
            generierter Corrective-Exercise-Plan vor.
          </p>
        )}
        <Link href="/admin/scans" className="mt-4 inline-block text-sm text-brand-700 underline">
          Zu SmartMotionScan &amp; Plan-Generierung →
        </Link>
      </main>
    );
  }

  const clientName = placeholderClients.find((c) => c.id === clientId)?.name ?? clientId;
  const byPhase = new Map<Phase, { ex: SessionExerciseLog; index: number }[]>();
  session.exercises.forEach((ex, index) => {
    const list = byPhase.get(ex.phase) ?? [];
    list.push({ ex, index });
    byPhase.set(ex.phase, list);
  });

  const isCompleted = session.status === "COMPLETED";

  return (
    <main className="flex-1 max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-extrabold">Trainingsdokumentation</h1>
      <p className="mt-2 text-slate-500">
        Sitzung für {clientName} · {new Date(session.createdAt).toLocaleDateString("de-DE")}
        {isCompleted && <span className="ml-2 rounded-full bg-brand-100 text-brand-700 text-xs px-2 py-0.5">Abgeschlossen</span>}
      </p>

      {/* --- Pre-training questionnaire --- */}
      <section className="mt-8 rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold">Vor dem Training</h2>
        <p className="mt-1 text-sm text-slate-500">Kurzer Check-in, bevor es losgeht.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <ScaleInput label="Schmerzlevel heute" value={session.pre?.painLevel} onChange={(v) => updatePre({ painLevel: v })} />
          <ScaleInput label="Energielevel" value={session.pre?.energyLevel} onChange={(v) => updatePre({ energyLevel: v })} />
          <ScaleInput label="Schlafqualität (letzte Nacht)" value={session.pre?.sleepQuality} onChange={(v) => updatePre({ sleepQuality: v })} />
          <ScaleInput label="Stresslevel" value={session.pre?.stressLevel} onChange={(v) => updatePre({ stressLevel: v })} />
          <div>
            <label className="block text-sm font-medium text-slate-700">Schmerzort (falls vorhanden)</label>
            <input
              type="text"
              value={session.pre?.painLocation ?? ""}
              onChange={(e) => updatePre({ painLocation: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm mt-6">
            <input
              type="checkbox"
              checked={session.pre?.readyToTrain ?? true}
              onChange={(e) => updatePre({ readyToTrain: e.target.checked })}
            />
            Bereit für das heutige Training
          </label>
        </div>
      </section>

      {/* --- Exercise checklist --- */}
      <section className="mt-6 rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold">Übungen</h2>
        <div className="mt-4 flex flex-col gap-6">
          {Array.from(byPhase.entries()).map(([phase, list]) => (
            <div key={phase}>
              <h3 className="text-sm font-semibold text-slate-700">
                {PHASE_LABELS[phase]}{" "}
                <span className="font-normal text-slate-400">({SMART_MOTION_APPROACH_LABELS[phase]})</span>
              </h3>
              <ul className="mt-2 flex flex-col gap-3">
                {list.map(({ ex, index }) => {
                  const seed = exerciseById.get(ex.exerciseId);
                  const instruction = renderPlanItemInstruction(
                    { sets: seed?.sets ?? [], unit: seed?.unit ?? "", pauseSeconds: seed?.pauseSeconds, dosageNote: seed?.dosageNote },
                    ex.side
                  );
                  return (
                    <li key={`${ex.exerciseId}-${index}`} className="rounded-lg border border-slate-100 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <input
                            type="checkbox"
                            checked={ex.completed}
                            onChange={(e) => updateExercise(index, { completed: e.target.checked })}
                          />
                          {ex.exerciseName}
                        </label>
                        <span
                          className={`text-[11px] rounded-full px-2 py-0.5 ${
                            ex.side === "BILATERAL" ? "bg-slate-100 text-slate-500" : "bg-amber-100 text-amber-800 font-medium"
                          }`}
                        >
                          {instruction.sideLabel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{instruction.dosageText}</p>

                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        <div>
                          <label className="block text-xs text-slate-500">Ist-Wdh./Sek. je Satz</label>
                          <input
                            type="text"
                            placeholder={seed?.sets?.join(", ") ?? ""}
                            defaultValue={ex.setsCompleted.join(", ")}
                            onBlur={(e) => updateExercise(index, { setsCompleted: parseSetsInput(e.target.value) })}
                            className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500">Schmerz während (0-10)</label>
                          <input
                            type="number"
                            min={0}
                            max={10}
                            value={ex.painDuringExercise ?? ""}
                            onChange={(e) => updateExercise(index, { painDuringExercise: e.target.value === "" ? null : Number(e.target.value) })}
                            className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500">Notiz</label>
                          <input
                            type="text"
                            value={ex.notes ?? ""}
                            onChange={(e) => updateExercise(index, { notes: e.target.value })}
                            className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* --- Post-training questionnaire --- */}
      <section className="mt-6 rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold">Nach dem Training</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <ScaleInput label="Anstrengung (RPE)" value={session.post?.rpe} onChange={(v) => updatePost({ rpe: v })} />
          <ScaleInput label="Schmerz während der Sitzung" value={session.post?.painDuringSession} onChange={(v) => updatePost({ painDuringSession: v })} />
          <ScaleInput label="Schmerz nach der Sitzung" value={session.post?.painAfterSession} onChange={(v) => updatePost({ painAfterSession: v })} />
          <ScaleInput label="Schwierigkeit (0=zu leicht, 10=zu schwer)" value={session.post?.difficultyRating} onChange={(v) => updatePost({ difficultyRating: v })} />
          <ScaleInput label="Zufriedenheit" value={session.post?.satisfaction} onChange={(v) => updatePost({ satisfaction: v })} />
          <label className="flex items-center gap-2 text-sm mt-6">
            <input
              type="checkbox"
              checked={session.post?.wouldRepeat ?? true}
              onChange={(e) => updatePost({ wouldRepeat: e.target.checked })}
            />
            Würde diese Sitzung so wiederholen
          </label>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700">Notizen</label>
            <textarea
              value={session.post?.notes ?? ""}
              onChange={(e) => updatePost({ notes: e.target.value })}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </section>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSaveProgress}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
        >
          Fortschritt speichern
        </button>
        <button
          type="button"
          onClick={handleCompleteSession}
          disabled={isCompleted}
          className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Sitzung abschließen
        </button>
        {saved && <span className="text-sm text-brand-700">Gespeichert.</span>}
        <Link href={`/admin/progress?clientId=${clientId}`} className="text-sm text-slate-500 underline">
          Zur Fortschrittsübersicht →
        </Link>
      </div>
    </main>
  );
}

// Extracts clientId/sessionId from the URL and remounts TrainingPageInner
// (via `key`) whenever either changes, so its localStorage-backed state
// (see loadInitialSession above) is (re-)computed fresh for the new
// identity instead of needing manual reset logic inside an effect.
function TrainingPageRouter() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get("clientId") ?? placeholderClients[0].id;
  const sessionIdParam = searchParams.get("sessionId");
  return <TrainingPageInner key={`${clientId}:${sessionIdParam ?? ""}`} clientId={clientId} sessionIdParam={sessionIdParam} />;
}

export default function TrainingPage() {
  return (
    <Suspense fallback={<main className="flex-1 max-w-2xl mx-auto px-6 py-16 text-sm text-slate-400">Lädt…</main>}>
      <TrainingPageRouter />
    </Suspense>
  );
}
