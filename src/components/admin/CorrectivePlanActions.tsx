"use client";

// §36/§38: Publish/Unpublish for one CorrectivePlan — mirrors the
// action-button pattern from admin/plans/[id]/PlanActions.tsx and
// admin/appointments/[id]/AppointmentActions.tsx (shared postAction()
// helper, router.refresh() after success). Used on both /admin/scans/[id]
// (cross-customer scan detail) and the customer detail page's
// SmartMotionScan tab, so publishing works from wherever the coach is
// already looking at the plan.
import { useState } from "react";
import { useRouter } from "next/navigation";

async function postAction(planId: string, action: string) {
  const res = await fetch(`/api/admin/corrective-plans/${planId}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Aktion fehlgeschlagen.");
  return data;
}

export default function CorrectivePlanActions({ planId, status }: { planId: string; status: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: string) {
    setSaving(true);
    setError(null);
    try {
      await postAction(planId, action);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aktion fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {status === "PUBLISHED" ? (
        <button
          type="button"
          disabled={saving}
          onClick={() => run("UNPUBLISH")}
          className="rounded-lg border border-ink-900/15 px-3 py-1.5 text-xs font-semibold text-ink-900 hover:bg-ink-900/5 disabled:opacity-50"
        >
          {saving ? "…" : "Zurückziehen (Review)"}
        </button>
      ) : (
        <button
          type="button"
          disabled={saving}
          onClick={() => run("PUBLISH")}
          className="rounded-lg bg-brand-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? "…" : "Veröffentlichen"}
        </button>
      )}
      {error && <p className="text-xs text-red-600 max-w-xs">{error}</p>}
    </div>
  );
}
