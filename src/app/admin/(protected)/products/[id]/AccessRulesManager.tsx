"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

type Rule = {
  id: string;
  customer: { id: string; firstName: string; lastName: string } | null;
  segment: { id: string; name: string } | null;
};
type Segment = { id: string; name: string };
type ClientOpt = { id: string; firstName: string; lastName: string; email: string };

export default function AccessRulesManager({
  productId,
  visibility,
  rules,
  segments,
  clients,
}: {
  productId: string;
  visibility: string;
  rules: Rule[];
  segments: Segment[];
  clients: ClientOpt[];
}) {
  const router = useRouter();
  const [targetId, setTargetId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (visibility === "ALL") {
    return <p className="text-sm text-ink-700/50">Sichtbarkeit steht auf „Für alle&quot; — keine Freigabeliste nötig.</p>;
  }

  const mode = visibility === "SEGMENTS" ? "segment" : "customer";

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!targetId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${productId}/access-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "segment" ? { segmentId: targetId } : { customerId: targetId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Freigabe konnte nicht angelegt werden.");
        return;
      }
      setTargetId("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ruleId: string) {
    await fetch(`/api/admin/products/${productId}/access-rules/${ruleId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      {rules.length === 0 ? (
        <p className="text-sm text-ink-700/50">Noch keine Freigaben — das Produkt ist damit für niemanden sichtbar.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-ink-900/10 p-3 text-sm">
              <span className="text-ink-900">{r.segment ? r.segment.name : r.customer ? `${r.customer.firstName} ${r.customer.lastName}` : "—"}</span>
              <button type="button" onClick={() => handleDelete(r.id)} className="text-xs text-red-600 hover:underline shrink-0">
                Entfernen
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleCreate} className="mt-4 flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-700/60">{mode === "segment" ? "Segment freigeben" : "Kunde freigeben"}</label>
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="min-w-[200px] rounded-lg border border-ink-900/15 px-3 py-2 text-sm">
            <option value="">— auswählen —</option>
            {mode === "segment"
              ? segments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))
              : clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName} ({c.email})
                  </option>
                ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={saving || !targetId}
          className="rounded-lg bg-ink-900 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Freigeben
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
