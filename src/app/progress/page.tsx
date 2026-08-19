"use client";

// Fortschrittsdokumentation: per-client history of training sessions plus
// simple trend lines for the pre-/post-training questionnaire scores (see
// /training and src/lib/trainingLog.ts). Reads the same localStorage-backed
// records /training writes — see trainingLog.ts for why this is
// localStorage rather than Prisma in Phase 1.
//
// Chart choices follow the project's dataviz skill: change-over-time with
// a single 0-10-bounded series per metric needs a plain single-hue line,
// no legend (the heading names the series), a direct end-label instead of
// a value on every point, and a table view alongside so nothing is
// gated behind the chart.

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { listSessions, TrainingSessionRecord } from "@/lib/trainingLog";

const placeholderClients = [
  { id: "demo-client-1", name: "Anna Beispiel" },
  { id: "demo-client-2", name: "Tom Muster" },
];

const TREND_COLOR = "#4f7a12"; // brand-600 (Athletik Movement green, see globals.css / branding.ts)

type TrendPoint = { date: string; value: number };

function Sparkline({ title, points }: { title: string; points: TrendPoint[] }) {
  const width = 320;
  const height = 90;
  const padding = 12;

  if (points.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <p className="mt-1 text-xs text-slate-400">Noch keine Daten.</p>
      </div>
    );
  }

  // Fixed 0-10 domain — every questionnaire scale here is a 0-10 rating,
  // so a fixed axis makes trends comparable across clients/sessions
  // instead of rescaling to whatever range happened to occur.
  const yFor = (v: number) => height - padding - (v / 10) * (height - 2 * padding);
  const xFor = (i: number) => (points.length === 1 ? width / 2 : padding + (i / (points.length - 1)) * (width - 2 * padding));

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(p.value).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-1 w-full" role="img" aria-label={`${title}-Verlauf`}>
        {/* recessive baseline grid — hairline, one step off the surface */}
        <line x1={padding} y1={yFor(0)} x2={width - padding} y2={yFor(0)} stroke="#e2e8f0" strokeWidth={1} />
        <path d={path} fill="none" stroke={TREND_COLOR} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={xFor(i)} cy={yFor(p.value)} r={4} fill={TREND_COLOR} stroke="#ffffff" strokeWidth={2}>
            <title>
              {new Date(p.date).toLocaleDateString("de-DE")}: {p.value}/10
            </title>
          </circle>
        ))}
        {/* direct end-label instead of labeling every point */}
        <text x={xFor(points.length - 1) + 8} y={yFor(last.value) + 4} fontSize={11} fill="#475569">
          {last.value}/10
        </text>
      </svg>
    </div>
  );
}

function ProgressPageInner() {
  const searchParams = useSearchParams();
  const [clientId, setClientId] = useState(searchParams.get("clientId") ?? placeholderClients[0].id);

  const sessions = useMemo(() => listSessions(clientId), [clientId]);

  const chronological = useMemo(
    () => [...sessions].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [sessions]
  );

  const painTrend: TrendPoint[] = chronological
    .filter((s) => s.pre?.painLevel != null)
    .map((s) => ({ date: s.completedAt ?? s.createdAt, value: s.pre!.painLevel as number }));

  const rpeTrend: TrendPoint[] = chronological
    .filter((s) => s.post?.rpe != null)
    .map((s) => ({ date: s.completedAt ?? s.createdAt, value: s.post!.rpe as number }));

  const total = sessions.length;
  const completed = sessions.filter((s) => s.status === "COMPLETED").length;
  const adherence = total > 0 ? Math.round((completed / total) * 100) : null;

  return (
    <main className="flex-1 max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-extrabold">Fortschrittsdokumentation</h1>
      <p className="mt-2 text-slate-500">
        Verlauf der Trainingssitzungen inkl. Vor-/Nach-Fragebogen, um Schmerz-, Anstrengungs- und
        Trainingstrends über die Zeit sichtbar zu machen.
      </p>

      <div className="mt-6">
        <label className="block text-sm font-medium text-slate-700">Kunde</label>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="mt-1 w-full sm:w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          {placeholderClients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* --- Stat tiles --- */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400">Sitzungen gesamt</p>
          <p className="mt-1 text-2xl font-semibold">{total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400">Abgeschlossen</p>
          <p className="mt-1 text-2xl font-semibold">{completed}</p>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400">Adhärenz</p>
          <p className="mt-1 text-2xl font-semibold">{adherence != null ? `${adherence}%` : "—"}</p>
        </div>
      </div>

      {/* --- Trends --- */}
      <section className="mt-6 rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold">Trends</h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <Sparkline title="Schmerzlevel vor dem Training (0-10)" points={painTrend} />
          <Sparkline title="Anstrengung / RPE nach dem Training (0-10)" points={rpeTrend} />
        </div>
      </section>

      {/* --- Session history (table view — same data as the charts above) --- */}
      <section className="mt-6 rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold">Sitzungsverlauf</h2>
        {sessions.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Noch keine Sitzungen. Starte eine über einen generierten Plan in{" "}
            <Link href="/scans" className="underline">
              SmartMotionScan
            </Link>
            .
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                  <th className="py-1.5 pr-3 font-medium">Datum</th>
                  <th className="py-1.5 pr-3 font-medium">Status</th>
                  <th className="py-1.5 pr-3 font-medium">Übungen erledigt</th>
                  <th className="py-1.5 pr-3 font-medium">Schmerz (vor)</th>
                  <th className="py-1.5 pr-3 font-medium">RPE (nach)</th>
                  <th className="py-1.5 pr-3 font-medium">Zufriedenheit</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s: TrainingSessionRecord) => {
                  const done = s.exercises.filter((e) => e.completed).length;
                  return (
                    <tr key={s.id} className="border-b border-slate-50">
                      <td className="py-1.5 pr-3 tabular-nums">
                        {new Date(s.completedAt ?? s.createdAt).toLocaleDateString("de-DE")}
                      </td>
                      <td className="py-1.5 pr-3">
                        <span
                          className={`text-[11px] rounded-full px-2 py-0.5 ${
                            s.status === "COMPLETED"
                              ? "bg-brand-100 text-brand-700"
                              : s.status === "SKIPPED"
                                ? "bg-red-50 text-red-600"
                                : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {s.status === "COMPLETED" ? "Abgeschlossen" : s.status === "SKIPPED" ? "Ausgelassen" : "Geplant"}
                        </span>
                      </td>
                      <td className="py-1.5 pr-3 tabular-nums">
                        {done}/{s.exercises.length}
                      </td>
                      <td className="py-1.5 pr-3 tabular-nums">{s.pre?.painLevel ?? "—"}</td>
                      <td className="py-1.5 pr-3 tabular-nums">{s.post?.rpe ?? "—"}</td>
                      <td className="py-1.5 pr-3 tabular-nums">{s.post?.satisfaction ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default function ProgressPage() {
  return (
    <Suspense fallback={<main className="flex-1 max-w-3xl mx-auto px-6 py-16 text-sm text-slate-400">Lädt…</main>}>
      <ProgressPageInner />
    </Suspense>
  );
}
