"use client";

// §32 Archiv, §34 Duplizieren, §35 Template -> Kundenplan, §38 Publish-Gate
// — mirrors the action-button pattern from
// admin/appointments/[id]/AppointmentActions.tsx (P4): one shared
// postAction() helper, a generic ActionButton with its own saving/error
// state, router.refresh() after success.
import { useState } from "react";
import { useRouter } from "next/navigation";

async function postAction(planId: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/admin/plans/${planId}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Aktion fehlgeschlagen.");
  return data;
}

function ActionButton({
  label,
  onRun,
  className,
}: {
  label: string;
  onRun: () => Promise<void>;
  className?: string;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          setError(null);
          try {
            await onRun();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Aktion fehlgeschlagen.");
          } finally {
            setSaving(false);
          }
        }}
        className={className ?? "rounded-lg border border-ink-900/15 px-3 py-1.5 text-sm font-semibold text-ink-900 hover:bg-ink-900/5 disabled:opacity-50"}
      >
        {saving ? "…" : label}
      </button>
      {error && <p className="text-xs text-red-600 max-w-xs">{error}</p>}
    </div>
  );
}

type Client = { id: string; firstName: string; lastName: string };

export default function PlanActions({
  planId,
  status,
  kind,
  clients,
}: {
  planId: string;
  status: string;
  kind: string;
  clients: Client[];
}) {
  const router = useRouter();
  const [assignClientId, setAssignClientId] = useState(clients[0]?.id ?? "");

  return (
    <div className="flex flex-wrap items-start gap-3">
      {status !== "ARCHIVED" && status !== "PUBLISHED" && (
        <ActionButton
          label="Veröffentlichen"
          className="rounded-lg bg-brand-600 text-white px-3 py-1.5 text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
          onRun={async () => {
            await postAction(planId, { action: "PUBLISH" });
            router.refresh();
          }}
        />
      )}
      {status === "PUBLISHED" && (
        <ActionButton
          label="Zurückziehen (Entwurf)"
          onRun={async () => {
            await postAction(planId, { action: "UNPUBLISH" });
            router.refresh();
          }}
        />
      )}

      <ActionButton
        label="Duplizieren"
        onRun={async () => {
          const data = await postAction(planId, { action: "DUPLICATE" });
          router.push(`/admin/plans/${data.plan.id}`);
        }}
      />

      {(kind === "TEMPLATE" || kind === "INDIVIDUAL") && clients.length > 0 && (
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink-700/60">Duplizieren &amp; Kunde zuweisen</label>
            <select
              value={assignClientId}
              onChange={(e) => setAssignClientId(e.target.value)}
              className="rounded-lg border border-ink-900/15 px-2.5 py-1.5 text-sm"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </select>
          </div>
          <ActionButton
            label="Zuweisen →"
            onRun={async () => {
              const data = await postAction(planId, { action: "DUPLICATE", clientId: assignClientId });
              router.push(`/admin/plans/${data.plan.id}`);
            }}
          />
        </div>
      )}

      {status !== "ARCHIVED" ? (
        <ActionButton
          label="Archivieren"
          className="rounded-lg border border-amber-300 text-amber-700 px-3 py-1.5 text-sm font-semibold hover:bg-amber-50 disabled:opacity-50"
          onRun={async () => {
            await postAction(planId, { action: "ARCHIVE" });
            router.refresh();
          }}
        />
      ) : (
        <ActionButton
          label="Wiederherstellen"
          onRun={async () => {
            await postAction(planId, { action: "UNARCHIVE" });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
