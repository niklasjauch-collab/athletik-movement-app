"use client";

// CoachAdmin briefing §33 PLAN BUILDER. One screen covering all 5 steps
// (Basis-Infos / Übungen auswählen+filtern / sortieren+Details je Übung /
// Vorschau / Speichern) rather than a literal multi-step wizard — the
// "Vorschau" is just the live item list below, always visible, and
// "Speichern" is the single Save button at the bottom. Reordering uses
// ▲▼ buttons instead of real drag & drop (no DnD library in this project
// yet) — same pragmatic-scoping trade-off as elsewhere in this build
// (e.g. the appointments list's quick-filters instead of a calendar grid).
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const PHASE_LABELS: Record<string, string> = {
  INHIBIT: "MoveFlexRelax",
  LENGTHEN: "MoveFlexStretch",
  ACTIVATE: "MoveSyncActivation",
  INTEGRATE: "MoveSyncIntegration",
};

type ExerciseOption = {
  id: string;
  name: string;
  correctivePhase: string | null;
  muscleGroups: string[];
  equipment: string[];
  unit: string;
  sets: number[];
  pauseSeconds: number;
  hasVideo: boolean;
  isPublished: boolean;
};

type PlanItem = {
  key: string; // stable client-side key, not necessarily the DB id (new rows have none yet)
  exerciseId: string;
  setsText: string;
  pauseSecondsOverride: string;
  notes: string;
};

type PlanEditorProps = {
  planId: string;
  initial: {
    title: string;
    description: string | null;
    goal: string | null;
    durationWeeks: number | null;
    frequencyPerWeek: number | null;
    items: Array<{
      exerciseId: string;
      setsOverride: number[];
      pauseSecondsOverride: number | null;
      notes: string | null;
    }>;
  };
  exercises: ExerciseOption[];
};

export default function PlanEditor({ planId, initial, exercises }: PlanEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description ?? "");
  const [goal, setGoal] = useState(initial.goal ?? "");
  const [durationWeeks, setDurationWeeks] = useState(initial.durationWeeks?.toString() ?? "");
  const [frequencyPerWeek, setFrequencyPerWeek] = useState(initial.frequencyPerWeek?.toString() ?? "");
  const [items, setItems] = useState<PlanItem[]>(
    initial.items.map((i, idx) => ({
      key: `existing-${idx}`,
      exerciseId: i.exerciseId,
      setsText: i.setsOverride.join(", "),
      pauseSecondsOverride: i.pauseSecondsOverride?.toString() ?? "",
      notes: i.notes ?? "",
    })),
  );

  const [q, setQ] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const exerciseById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  const equipmentOptions = useMemo(
    () => Array.from(new Set(exercises.flatMap((e) => e.equipment))).sort(),
    [exercises],
  );
  const regionOptions = useMemo(
    () => Array.from(new Set(exercises.flatMap((e) => e.muscleGroups))).sort(),
    [exercises],
  );

  const filteredExercises = useMemo(() => {
    return exercises.filter((e) => {
      if (q && !e.name.toLowerCase().includes(q.toLowerCase())) return false;
      if (phaseFilter && e.correctivePhase !== phaseFilter) return false;
      if (equipmentFilter && !e.equipment.includes(equipmentFilter)) return false;
      if (regionFilter && !e.muscleGroups.includes(regionFilter)) return false;
      return true;
    });
  }, [exercises, q, phaseFilter, equipmentFilter, regionFilter]);

  function addExercise(exerciseId: string) {
    setSaved(false);
    setItems((prev) => [
      ...prev,
      { key: `new-${Date.now()}-${Math.random()}`, exerciseId, setsText: "", pauseSecondsOverride: "", notes: "" },
    ]);
  }

  function removeItem(key: string) {
    setSaved(false);
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function moveItem(index: number, direction: -1 | 1) {
    setSaved(false);
    setItems((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function updateItem(key: string, patch: Partial<PlanItem>) {
    setSaved(false);
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          goal: goal || null,
          durationWeeks: durationWeeks ? parseInt(durationWeeks, 10) : null,
          frequencyPerWeek: frequencyPerWeek ? parseInt(frequencyPerWeek, 10) : null,
          items: items.map((item, index) => ({
            exerciseId: item.exerciseId,
            order: index,
            setsOverride: item.setsText
              .split(",")
              .map((s) => parseInt(s.trim(), 10))
              .filter((n) => Number.isFinite(n)),
            pauseSecondsOverride: item.pauseSecondsOverride ? parseInt(item.pauseSecondsOverride, 10) : null,
            notes: item.notes || null,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      setSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-8">
      {/* Schritt 1 */}
      <section className="rounded-xl border border-ink-900/10 p-5">
        <h2 className="font-semibold text-ink-900">1. Basis-Infos</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-xs text-ink-700/60">Titel</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm" />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-xs text-ink-700/60">Beschreibung</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink-700/60">Ziel</label>
            <input value={goal} onChange={(e) => setGoal(e.target.value)} className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink-700/60">Dauer (Wochen)</label>
            <input
              type="number"
              min={0}
              value={durationWeeks}
              onChange={(e) => setDurationWeeks(e.target.value)}
              className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink-700/60">Häufigkeit (x pro Woche)</label>
            <input
              type="number"
              min={0}
              value={frequencyPerWeek}
              onChange={(e) => setFrequencyPerWeek(e.target.value)}
              className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </section>

      {/* Schritt 2 */}
      <section className="rounded-xl border border-ink-900/10 p-5">
        <h2 className="font-semibold text-ink-900">2. Übungen auswählen</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name…"
            className="flex-1 min-w-[160px] rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
          />
          <select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)} className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm">
            <option value="">Alle Phasen</option>
            {Object.entries(PHASE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm">
            <option value="">Alle Körperregionen</option>
            {regionOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select value={equipmentFilter} onChange={(e) => setEquipmentFilter(e.target.value)} className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm">
            <option value="">Alles Equipment</option>
            {equipmentOptions.map((eq) => (
              <option key={eq} value={eq}>
                {eq}
              </option>
            ))}
          </select>
        </div>

        <ul className="mt-3 max-h-72 overflow-y-auto divide-y divide-ink-900/5 rounded-lg border border-ink-900/10">
          {filteredExercises.slice(0, 100).map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div>
                <span className="font-medium text-ink-900">{e.name}</span>
                <span className="ml-2 text-xs text-ink-700/50">
                  {e.correctivePhase ? PHASE_LABELS[e.correctivePhase] ?? e.correctivePhase : "—"}
                  {!e.hasVideo && <span className="ml-1 text-amber-600">· kein Video</span>}
                  {!e.isPublished && <span className="ml-1 text-slate-400">· Entwurf</span>}
                </span>
              </div>
              <button
                type="button"
                onClick={() => addExercise(e.id)}
                className="shrink-0 rounded-lg border border-ink-900/15 px-2.5 py-1 text-xs font-semibold text-ink-900 hover:bg-ink-900/5"
              >
                + Hinzufügen
              </button>
            </li>
          ))}
          {filteredExercises.length === 0 && <li className="px-3 py-4 text-sm text-ink-700/50">Keine Übung gefunden.</li>}
        </ul>
      </section>

      {/* Schritt 3 + 4 */}
      <section className="rounded-xl border border-ink-900/10 p-5">
        <h2 className="font-semibold text-ink-900">3. Reihenfolge &amp; Details ({items.length} Übung(en))</h2>
        {items.length === 0 ? (
          <p className="mt-2 text-sm text-ink-700/50">Noch keine Übungen im Plan — oben hinzufügen.</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-3">
            {items.map((item, index) => {
              const ex = exerciseById.get(item.exerciseId);
              return (
                <li key={item.key} className="rounded-lg border border-ink-900/10 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-sm text-ink-900">
                      {index + 1}. {ex?.name ?? item.exerciseId}
                    </span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => moveItem(index, -1)} disabled={index === 0} className="rounded border border-ink-900/15 px-2 py-0.5 text-xs disabled:opacity-30">
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => moveItem(index, 1)}
                        disabled={index === items.length - 1}
                        className="rounded border border-ink-900/15 px-2 py-0.5 text-xs disabled:opacity-30"
                      >
                        ▼
                      </button>
                      <button type="button" onClick={() => removeItem(item.key)} className="ml-2 rounded border border-red-200 px-2 py-0.5 text-xs text-red-600">
                        Entfernen
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-ink-700/60">
                        Sätze ({ex?.unit === "Sekunden" ? "Sek." : "Wdh."}, kommagetrennt)
                      </label>
                      <input
                        value={item.setsText}
                        onChange={(e) => updateItem(item.key, { setsText: e.target.value })}
                        placeholder={ex ? ex.sets.join(", ") || "Standard" : "Standard"}
                        className="rounded-lg border border-ink-900/15 px-2.5 py-1.5 text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-ink-700/60">Pause (Sek.)</label>
                      <input
                        type="number"
                        min={0}
                        value={item.pauseSecondsOverride}
                        onChange={(e) => updateItem(item.key, { pauseSecondsOverride: e.target.value })}
                        placeholder={ex ? String(ex.pauseSeconds) : ""}
                        className="rounded-lg border border-ink-900/15 px-2.5 py-1.5 text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-ink-700/60">Notiz für Kunde</label>
                      <input
                        value={item.notes}
                        onChange={(e) => updateItem(item.key, { notes: e.target.value })}
                        className="rounded-lg border border-ink-900/15 px-2.5 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Schritt 5 */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="rounded-lg bg-ink-900 text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Speichert…" : "Speichern"}
        </button>
        {saved && <span className="text-sm text-brand-700">Gespeichert.</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}
