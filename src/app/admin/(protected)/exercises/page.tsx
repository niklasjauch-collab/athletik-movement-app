import Link from "next/link";
import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const PHASE_LABELS: Record<string, string> = {
  INHIBIT: "MoveFlexRelax",
  LENGTHEN: "MoveFlexStretch",
  ACTIVATE: "MoveSyncActivation",
  INTEGRATE: "MoveSyncIntegration",
};

// CoachAdmin briefing §37 ÜBUNGSVERWALTUNG — rebuilt on top of Prisma
// (was a static seed-data JSON read, see git history / the old
// exercises/drafts/page.tsx for the earlier Phase-1 versions of this
// page). "Video vorhanden" is computed the same generous way the old
// static page did (any of videoMaleUrl/videoFemaleUrl/videoMalePath/
// videoFemalePath) — most exercises still only have the legacy *Path
// fields until real video files are re-hosted, see README.
export default async function ExercisesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const phase = sp.phase ?? "";
  const region = sp.region ?? "";
  const equipment = sp.equipment ?? "";
  const status = sp.status ?? ""; // "published" | "draft" | ""
  const videoFilter = sp.video ?? ""; // "missing" | "present" | ""

  const provider = await getActiveProvider();

  const all = await prisma.exercise.findMany({
    where: { providerId: provider.id },
    orderBy: { name: "asc" },
    include: { _count: { select: { planItems: true } } },
  });

  /* eslint-disable @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */
  const regionOptions: string[] = (Array.from(new Set(all.flatMap((e: any) => e.muscleGroups as string[]))) as string[]).sort();
  const equipmentOptions: string[] = (Array.from(new Set(all.flatMap((e: any) => e.equipment as string[]))) as string[]).sort();

  const exercises = all.filter((e: any) => {
    const hasVideo = Boolean(e.videoMaleUrl || e.videoFemaleUrl || e.videoMalePath || e.videoFemalePath);
    if (q && !e.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (phase && e.correctivePhase !== phase) return false;
    if (region && !e.muscleGroups.includes(region)) return false;
    if (equipment && !e.equipment.includes(equipment)) return false;
    if (status === "published" && !e.isPublished) return false;
    if (status === "draft" && e.isPublished) return false;
    if (videoFilter === "missing" && hasVideo) return false;
    if (videoFilter === "present" && !hasVideo) return false;
    return true;
  });

  const missingVideoCount = all.filter(
    (e: any) => !e.videoMaleUrl && !e.videoFemaleUrl && !e.videoMalePath && !e.videoFemalePath,
  ).length;
  /* eslint-enable @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */

  const qs = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q, phase, region, equipment, status, video: videoFilter, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const s = params.toString();
    return s ? `/admin/exercises?${s}` : "/admin/exercises";
  };

  return (
    <main className="flex-1 px-6 py-10 max-w-5xl mx-auto">
      <p className="text-sm text-ink-700/50">
        <Link href="/admin" className="hover:underline">
          ← Dashboard
        </Link>
      </p>
      <h1 className="mt-2 font-serif text-3xl font-bold text-ink-900">Übungen</h1>
      <p className="mt-1 text-sm text-ink-700/70">
        {exercises.length} von {all.length} Übung(en). {missingVideoCount} ohne Video insgesamt.
      </p>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <Link
          href={qs({ video: videoFilter === "missing" ? "" : "missing" })}
          className={`rounded-lg px-3 py-1.5 font-medium ${
            videoFilter === "missing" ? "bg-amber-600 text-white" : "border border-amber-300 text-amber-700"
          }`}
        >
          Video fehlt
        </Link>
      </div>

      <form className="mt-4 flex flex-wrap gap-3" method="get">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Name…"
          className="flex-1 min-w-[180px] rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
        />
        <select name="phase" defaultValue={phase} className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm">
          <option value="">Alle Phasen</option>
          {Object.entries(PHASE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select name="region" defaultValue={region} className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm">
          <option value="">Alle Körperregionen</option>
          {regionOptions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select name="equipment" defaultValue={equipment} className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm">
          <option value="">Alles Equipment</option>
          {equipmentOptions.map((eq) => (
            <option key={eq} value={eq}>
              {eq}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status} className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm">
          <option value="">Alle Status</option>
          <option value="published">Veröffentlicht</option>
          <option value="draft">Entwurf</option>
        </select>
        <select name="video" defaultValue={videoFilter} className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm">
          <option value="">Video: egal</option>
          <option value="present">Video vorhanden</option>
          <option value="missing">Video fehlt</option>
        </select>
        <button type="submit" className="rounded-lg bg-ink-900 text-white px-4 py-2 text-sm font-semibold">
          Filtern
        </button>
      </form>

      {exercises.length === 0 ? (
        <p className="mt-10 text-sm text-ink-700/60">Keine Übung gefunden.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-ink-900/10">
          <table className="w-full text-sm">
            <thead className="bg-ink-900/5 text-left text-xs uppercase tracking-wide text-ink-900/50">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phase</th>
                <th className="px-4 py-3">Video</th>
                <th className="px-4 py-3">Verwendet in</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-900/5">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
              {exercises.map((e: any) => {
                const hasVideo = Boolean(e.videoMaleUrl || e.videoFemaleUrl || e.videoMalePath || e.videoFemalePath);
                return (
                  <tr key={e.id} className="hover:bg-ink-900/[0.03]">
                    <td className="px-4 py-3">
                      <Link href={`/admin/exercises/${e.id}`} className="font-medium text-ink-900 hover:underline">
                        {e.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-700/70">
                      {e.correctivePhase ? PHASE_LABELS[e.correctivePhase] ?? e.correctivePhase : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={hasVideo ? "text-brand-600" : "text-amber-600 font-medium"}>
                        {hasVideo ? "vorhanden" : "fehlt"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-700/60">{e._count.planItems} Plan(e)</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          e.isPublished ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {e.isPublished ? "Veröffentlicht" : "Entwurf"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
