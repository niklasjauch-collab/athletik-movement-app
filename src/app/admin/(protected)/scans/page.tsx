"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  COMPENSATION_RULES,
  CompensationKey,
  PHASES,
  PHASE_LABELS,
  SMART_MOTION_APPROACH_LABELS,
} from "@/lib/corrective/rules";
import {
  generatePlan,
  ExerciseCandidate,
  FindingInput,
  Side,
} from "@/lib/corrective/generatePlan";
import { renderPlanItemInstruction } from "@/lib/corrective/sideInstructions";
import { saveLatestPlan, createSessionFromPlan } from "@/lib/trainingLog";
import exercisesData from "../../../../../prisma/seed-data/exercises.json";
import correctiveExercisesData from "../../../../../prisma/seed-data/corrective-exercises.json";

// TODO (Phase 1 -> real data): replace with a Prisma query for the
// current Provider's clients (`prisma.client.findMany({ where: { providerId }})`).
const placeholderClients = [
  { id: "demo-client-1", name: "Anna Beispiel" },
  { id: "demo-client-2", name: "Tom Muster" },
];

type SeedExercise = {
  legacyId: string | null;
  name: string;
  correctivePhase: string | null;
  targetMuscles: string[];
  taggingSource: string | null;
  sets: number[];
  unit: string;
  pauseSeconds: number;
  dosageNote?: string | null;
};

const allExercises = [
  ...(exercisesData as SeedExercise[]),
  ...(correctiveExercisesData as SeedExercise[]),
];

const exerciseCandidates: ExerciseCandidate[] = allExercises.map((e, i) => ({
  id: e.legacyId ?? `generic-${i}`,
  name: e.name,
  correctivePhase: e.correctivePhase as ExerciseCandidate["correctivePhase"],
  targetMuscles: e.targetMuscles,
  taggingSource: e.taggingSource,
}));

// Keyed the same way as exerciseCandidates above, so plan items (which
// only carry exerciseId/exerciseName) can look back up dosage info
// (sets/unit/pauseSeconds/dosageNote) to render side-aware instructions.
const exerciseById = new Map<string, SeedExercise>(
  allExercises.map((e, i) => [e.legacyId ?? `generic-${i}`, e])
);

const VIEW_LABELS: Record<string, string> = {
  anterior: "Vorderansicht",
  lateral: "Seitenansicht",
  posterior: "Rückansicht",
};

type UploadedScan = {
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
};

type AnalyzeFinding = {
  compensation: CompensationKey;
  side: Side;
  confidence: "high" | "medium" | "low";
  evidence?: string;
};

export default function ScansPage() {
  const router = useRouter();
  const [clientId, setClientId] = useState(placeholderClients[0].id);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedScan, setUploadedScan] = useState<UploadedScan | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analyzeNotConfigured, setAnalyzeNotConfigured] = useState(false);
  const [analyzeSummary, setAnalyzeSummary] = useState<string | null>(null);
  const [analyzeUnreadable, setAnalyzeUnreadable] = useState(false);
  const [aiFindings, setAiFindings] = useState<Record<string, AnalyzeFinding>>({});

  const [findings, setFindings] = useState<Record<string, Side>>({});
  const [starting, setStarting] = useState(false);

  const plan = useMemo(() => {
    const selected: FindingInput[] = Object.entries(findings).map(([compensation, side]) => ({
      compensation: compensation as CompensationKey,
      side,
    }));
    if (selected.length === 0) return null;
    return generatePlan(selected, exerciseCandidates);
  }, [findings]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSelectedFile(e.target.files?.[0] ?? null);
    setUploadedScan(null);
    setAnalyzeSummary(null);
    setAnalyzeUnreadable(false);
    setAiFindings({});
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadError(null);
    if (!selectedFile) {
      setUploadError("Bitte eine Datei auswählen.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("clientId", clientId);

    setUploading(true);
    try {
      const res = await fetch("/api/scans/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Upload fehlgeschlagen.");
      }
      const data = await res.json();
      setUploadedScan(data);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
    } finally {
      setUploading(false);
    }
  }

  async function handleAnalyze() {
    if (!selectedFile) {
      setAnalyzeError("Bitte zuerst eine Datei auswählen.");
      return;
    }
    setAnalyzeError(null);
    setAnalyzeNotConfigured(false);
    setAnalyzeUnreadable(false);
    setAnalyzing(true);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch("/api/scans/analyze", { method: "POST", body: formData });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 501) setAnalyzeNotConfigured(true);
        throw new Error(body.error ?? "Analyse fehlgeschlagen.");
      }
      setAnalyzeSummary(body.summary || null);
      setAnalyzeUnreadable(Boolean(body.unreadable));

      const suggested: Record<string, AnalyzeFinding> = {};
      const nextFindings: Record<string, Side> = { ...findings };
      for (const f of (body.findings ?? []) as AnalyzeFinding[]) {
        suggested[f.compensation] = f;
        nextFindings[f.compensation] = f.side;
      }
      setAiFindings(suggested);
      setFindings(nextFindings);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Analyse fehlgeschlagen.");
    } finally {
      setAnalyzing(false);
    }
  }

  function toggleCompensation(key: CompensationKey, checked: boolean) {
    setFindings((prev) => {
      const next = { ...prev };
      if (checked) next[key] = next[key] ?? "BILATERAL";
      else delete next[key];
      return next;
    });
  }

  function setSide(key: CompensationKey, side: Side) {
    setFindings((prev) => ({ ...prev, [key]: side }));
  }

  function handleStartSession() {
    if (!plan) return;
    setStarting(true);
    const record = {
      clientId,
      generatedAt: new Date().toISOString(),
      scanFileName: uploadedScan?.fileName ?? null,
      findings: Object.entries(findings).map(([compensation, side]) => ({
        compensation: compensation as CompensationKey,
        side,
      })),
      items: plan.items,
    };
    saveLatestPlan(record);
    const session = createSessionFromPlan(clientId, record);
    router.push(`/admin/training?clientId=${encodeURIComponent(clientId)}&sessionId=${encodeURIComponent(session.id)}`);
  }

  const compensationsByView: Record<string, CompensationKey[]> = { anterior: [], lateral: [], posterior: [] };
  for (const key of Object.keys(COMPENSATION_RULES) as CompensationKey[]) {
    compensationsByView[COMPENSATION_RULES[key].view].push(key);
  }

  return (
    <main className="flex-1 max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-extrabold">SmartMotionScan &amp; Corrective Exercise</h1>
      <p className="mt-2 text-slate-500">
        Bewegungsscan hochladen, Befunde prüfen und automatisch einen
        individuellen, seiten-genauen Corrective-Exercise-Plan nach dem NASM
        Corrective Exercise Continuum / SmartMotionApproach generieren.
      </p>

      {/* --- Step 1: upload --- */}
      <section className="mt-10 rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold">1. Scan-Ergebnis hochladen</h2>
        <p className="mt-1 text-sm text-slate-500">
          PDF-Bericht oder Foto vom SmartMotionScan (Moti Physio 2). Die
          Datei wird zur Kundenakte gespeichert.
        </p>

        <form onSubmit={handleUpload} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700">Kunde</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {placeholderClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700">Datei</label>
            <input
              type="file"
              name="file"
              accept="application/pdf,image/*"
              onChange={handleFileChange}
              className="mt-1 w-full text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="rounded-lg bg-ink-900 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {uploading ? "Lädt hoch…" : "Hochladen"}
          </button>
        </form>

        {uploadError && <p className="mt-2 text-sm text-red-600">{uploadError}</p>}
        {uploadedScan && (
          <p className="mt-2 text-sm text-brand-700">
            „{uploadedScan.fileName}“ hochgeladen für {placeholderClients.find((c) => c.id === clientId)?.name}.
          </p>
        )}

        <div className="mt-4 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={analyzing || !selectedFile}
            className="rounded-lg border border-brand-600 text-brand-700 px-4 py-2 text-sm font-semibold disabled:opacity-40"
          >
            {analyzing ? "Analysiert…" : "🤖 PDF automatisch analysieren (KI-Vorschlag)"}
          </button>
          <p className="mt-2 text-xs text-slate-400">
            Liest den Bericht per KI und schlägt Befunde inkl. Seite (links/rechts/beidseitig)
            unten in Schritt 2 vor — geprüft und bei Bedarf korrigiert werden muss trotzdem von dir,
            bevor daraus ein Plan generiert wird. Da hierbei Gesundheitsdaten an die Anthropic-API
            übertragen werden, nur mit Einwilligung des Kunden und AVV nutzen (siehe README).
          </p>
          {analyzeNotConfigured && (
            <p className="mt-2 text-sm text-amber-600">
              Automatische Analyse ist in dieser Umgebung nicht konfiguriert (ANTHROPIC_API_KEY fehlt) —
              bitte Befunde unten manuell erfassen.
            </p>
          )}
          {analyzeError && !analyzeNotConfigured && (
            <p className="mt-2 text-sm text-red-600">{analyzeError}</p>
          )}
          {analyzeUnreadable && (
            <p className="mt-2 text-sm text-amber-600">
              Die KI konnte in dieser Datei kein auswertbares Bewegungsassessment erkennen — bitte
              Datei prüfen oder Befunde manuell erfassen.
            </p>
          )}
          {analyzeSummary && (
            <p className="mt-2 text-sm text-slate-600 bg-brand-50 rounded-lg p-3">
              <span className="font-semibold">KI-Zusammenfassung: </span>
              {analyzeSummary}
            </p>
          )}
        </div>
      </section>

      {/* --- Step 2: findings --- */}
      <section className="mt-6 rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold">2. Befunde aus dem Scan-Bericht erfassen</h2>
        <p className="mt-1 text-sm text-slate-500">
          Kompensationen ankreuzen, die im SmartMotionScan-Bericht (statische
          Analyse + Overhead Squat / Single-Leg-Stance) auffällig waren, und für
          jede angeben, ob nur eine Seite betroffen ist.
        </p>

        {Object.entries(compensationsByView).map(([view, keys]) => (
          <div key={view} className="mt-5">
            <h3 className="text-sm font-semibold text-slate-600">{VIEW_LABELS[view]}</h3>
            <ul className="mt-2 flex flex-col gap-2">
              {keys.map((key) => {
                const rule = COMPENSATION_RULES[key];
                const checked = key in findings;
                const ai = aiFindings[key];
                return (
                  <li key={key} className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggleCompensation(key, e.target.checked)}
                      />
                      {rule.label}
                    </label>
                    {ai && (
                      <span
                        title={ai.evidence ?? ""}
                        className="text-[11px] rounded-full bg-brand-100 text-brand-700 px-2 py-0.5"
                      >
                        🤖 KI-Vorschlag ({ai.confidence === "high" ? "hohe" : ai.confidence === "medium" ? "mittlere" : "geringe"} Konfidenz)
                      </span>
                    )}
                    {checked && (
                      <div className="flex gap-2 text-xs text-slate-500">
                        {(["LEFT", "RIGHT", "BILATERAL"] as Side[]).map((side) => (
                          <label key={side} className="flex items-center gap-1">
                            <input
                              type="radio"
                              name={`side-${key}`}
                              checked={findings[key] === side}
                              onChange={() => setSide(key, side)}
                            />
                            {side === "LEFT" ? "Links" : side === "RIGHT" ? "Rechts" : "Beidseitig"}
                          </label>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      {/* --- Step 3: generated plan --- */}
      <section className="mt-6 rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold">3. Automatisch generierter Corrective-Exercise-Plan</h2>

        {!plan && (
          <p className="mt-2 text-sm text-slate-500">
            Noch keine Befunde ausgewählt — Plan erscheint hier automatisch.
          </p>
        )}

        {plan && (
          <div className="mt-4 flex flex-col gap-6">
            {PHASES.map((phase) => {
              const items = plan.items.filter((i) => i.phase === phase);
              const gaps = plan.gaps[phase];
              return (
                <div key={phase}>
                  <h3 className="text-sm font-semibold text-slate-700">
                    {PHASE_LABELS[phase]}{" "}
                    <span className="font-normal text-slate-400">
                      ({SMART_MOTION_APPROACH_LABELS[phase]})
                    </span>
                  </h3>
                  {items.length === 0 && !gaps && (
                    <p className="mt-1 text-sm text-slate-400">Keine Übungen nötig.</p>
                  )}
                  <ul className="mt-2 flex flex-col gap-2">
                    {items.map((item) => {
                      const ex = exerciseById.get(item.exerciseId);
                      const reasonLabel = item.sourceCompensations
                        .map((c) => COMPENSATION_RULES[c]?.label)
                        .filter(Boolean)
                        .join(", ");
                      const instruction = renderPlanItemInstruction(
                        {
                          sets: ex?.sets ?? [],
                          unit: ex?.unit ?? "",
                          pauseSeconds: ex?.pauseSeconds,
                          dosageNote: ex?.dosageNote,
                        },
                        item.side,
                        reasonLabel
                      );
                      return (
                        <li key={item.exerciseId} className="text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{item.exerciseName}</span>
                            <span className="text-slate-400">— {item.targetMuscles.join(", ")}</span>
                            <span
                              className={`text-[11px] rounded-full px-2 py-0.5 ${
                                item.side === "BILATERAL"
                                  ? "bg-slate-100 text-slate-500"
                                  : "bg-amber-100 text-amber-800 font-medium"
                              }`}
                            >
                              {instruction.sideLabel}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{instruction.dosageText}</p>
                          {instruction.sideNote && (
                            <p className="text-xs text-amber-700 mt-0.5">{instruction.sideNote}</p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {gaps && gaps.length > 0 && (
                    <p className="mt-1 text-xs text-amber-600">
                      Keine passende Übung in der Bibliothek für: {gaps.join(", ")}
                    </p>
                  )}
                </div>
              );
            })}

            <div className="border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={handleStartSession}
                disabled={starting}
                className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                Diesen Plan als Trainingssitzung starten →
              </button>
              <p className="mt-1 text-xs text-slate-400">
                Öffnet die Trainings- &amp; Fortschrittsdokumentation mit Vor-Fragebogen,
                Übungs-Checkliste und Nach-Fragebogen für {placeholderClients.find((c) => c.id === clientId)?.name}.
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
