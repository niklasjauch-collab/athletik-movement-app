"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

type Price = {
  id: string;
  scope: string;
  priceCents: number;
  currency: string;
  reasonNote: string | null;
  customer: { id: string; firstName: string; lastName: string } | null;
  segment: { id: string; name: string } | null;
};
type Segment = { id: string; name: string };
type ClientOpt = { id: string; firstName: string; lastName: string; email: string };

export default function PricesManager({
  productId,
  prices,
  segments,
  clients,
}: {
  productId: string;
  prices: Price[];
  segments: Segment[];
  clients: ClientOpt[];
}) {
  const router = useRouter();
  const [scope, setScope] = useState<"SEGMENT" | "CUSTOMER">("SEGMENT");
  const [targetId, setTargetId] = useState("");
  const [priceEuro, setPriceEuro] = useState("");
  const [reasonNote, setReasonNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!targetId || !priceEuro) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${productId}/prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          segmentId: scope === "SEGMENT" ? targetId : undefined,
          customerId: scope === "CUSTOMER" ? targetId : undefined,
          priceCents: Math.round(parseFloat(priceEuro.replace(",", ".") || "0") * 100),
          reasonNote,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Sonderpreis konnte nicht angelegt werden.");
        return;
      }
      setTargetId("");
      setPriceEuro("");
      setReasonNote("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(priceId: string) {
    await fetch(`/api/admin/products/${productId}/prices/${priceId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      {prices.length === 0 ? (
        <p className="text-sm text-ink-700/50">Keine Sonderpreise.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {prices.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-ink-900/10 p-3 text-sm">
              <div>
                <p className="font-medium text-ink-900">
                  {p.segment ? `Segment: ${p.segment.name}` : p.customer ? `Kunde: ${p.customer.firstName} ${p.customer.lastName}` : "—"}
                  {" — "}
                  {(p.priceCents / 100).toLocaleString("de-DE", { style: "currency", currency: p.currency })}
                </p>
                {p.reasonNote && <p className="text-xs text-ink-700/50">{p.reasonNote}</p>}
              </div>
              <button type="button" onClick={() => handleDelete(p.id)} className="text-xs text-red-600 hover:underline shrink-0">
                Entfernen
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleCreate} className="mt-4 flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-700/60">Geltungsbereich</label>
          <select
            value={scope}
            onChange={(e) => {
              setScope(e.target.value as "SEGMENT" | "CUSTOMER");
              setTargetId("");
            }}
            className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
          >
            <option value="SEGMENT">Segment</option>
            <option value="CUSTOMER">Einzelner Kunde</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-700/60">{scope === "SEGMENT" ? "Segment" : "Kunde"}</label>
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="min-w-[180px] rounded-lg border border-ink-900/15 px-3 py-2 text-sm">
            <option value="">— auswählen —</option>
            {scope === "SEGMENT"
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
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-700/60">Preis (€)</label>
          <input value={priceEuro} onChange={(e) => setPriceEuro(e.target.value)} inputMode="decimal" className="w-24 rounded-lg border border-ink-900/15 px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-700/60">Grund (optional)</label>
          <input
            value={reasonNote}
            onChange={(e) => setReasonNote(e.target.value)}
            placeholder="z. B. Freund, Kulanz"
            className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={saving || !targetId || !priceEuro}
          className="rounded-lg bg-ink-900 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Anlegen
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
