"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

const KIND_OPTIONS = [
  { value: "TEMPLATE", label: "Template" },
  { value: "INDIVIDUAL", label: "Kundenplan" },
  { value: "SELLABLE", label: "Shop-Plan" },
];

type Client = { id: string; firstName: string; lastName: string };

export default function CreatePlanForm({ defaultKind, clients }: { defaultKind: string; clients: Client[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState(defaultKind);
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, kind, clientId: kind === "INDIVIDUAL" ? clientId : undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Plan konnte nicht erstellt werden.");
        return;
      }
      router.push(`/admin/plans/${data.plan.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-700/60">Titel</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="z. B. Corrective Exercise — LPHC Schwerpunkt"
          className="min-w-[260px] rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-700/60">Art</label>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm">
          {KIND_OPTIONS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </div>
      {kind === "INDIVIDUAL" && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-700/60">Kunde</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="min-w-[200px] rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </select>
        </div>
      )}
      <button
        type="submit"
        disabled={saving || !title.trim() || (kind === "INDIVIDUAL" && !clientId)}
        className="rounded-lg bg-ink-900 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
      >
        Anlegen &amp; bearbeiten →
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
