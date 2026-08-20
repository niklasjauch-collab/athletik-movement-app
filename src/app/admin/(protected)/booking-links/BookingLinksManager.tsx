"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

type Link = {
  id: string;
  name: string;
  url: string;
  type: string | null;
  active: boolean;
  product: { id: string; name: string } | null;
  segment: { id: string; name: string } | null;
};
type Option = { id: string; name: string };

function scopeLabel(l: Link) {
  if (l.product && l.segment) return `${l.product.name} · Segment: ${l.segment.name}`;
  if (l.product) return l.product.name;
  if (l.segment) return `Segment: ${l.segment.name}`;
  return "Standard (kein Produkt-/Segmentbezug)";
}

export default function BookingLinksManager({ links, products, segments }: { links: Link[]; products: Option[]; segments: Option[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState("");
  const [productId, setProductId] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/booking-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url, type: type || undefined, productId: productId || undefined, segmentId: segmentId || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Buchungslink konnte nicht angelegt werden.");
        return;
      }
      setName("");
      setUrl("");
      setType("");
      setProductId("");
      setSegmentId("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/admin/booking-links/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    router.refresh();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/booking-links/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="mt-6">
      {links.length === 0 ? (
        <p className="text-sm text-ink-700/60">Noch keine Buchungslinks.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-900/10">
          <table className="w-full text-sm">
            <thead className="bg-ink-900/5 text-left text-xs uppercase tracking-wide text-ink-900/50">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Geltungsbereich</th>
                <th className="px-4 py-3">URL</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-900/5">
              {links.map((l) => (
                <tr key={l.id} className="hover:bg-ink-900/[0.03]">
                  <td className="px-4 py-3 font-medium text-ink-900">
                    {l.name}
                    {l.type && <span className="ml-2 text-[10px] uppercase text-ink-700/40">{l.type}</span>}
                  </td>
                  <td className="px-4 py-3 text-ink-700/70">{scopeLabel(l)}</td>
                  <td className="px-4 py-3 text-ink-700/50 max-w-[220px] truncate">{l.url}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleActive(l.id, l.active)}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${l.active ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-500"}`}
                    >
                      {l.active ? "Aktiv" : "Inaktiv"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => handleDelete(l.id)} className="text-xs text-red-600 hover:underline">
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={handleCreate} className="mt-6 flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-700/60">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Legacy Coaching 2025" className="min-w-[180px] rounded-lg border border-ink-900/15 px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-700/60">Calendly-URL</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://calendly.com/…" className="min-w-[220px] rounded-lg border border-ink-900/15 px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-700/60">Label (optional)</label>
          <input value={type} onChange={(e) => setType(e.target.value)} placeholder="Standard / Beta / Partner …" className="w-32 rounded-lg border border-ink-900/15 px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-700/60">Produkt (optional)</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm">
            <option value="">— alle —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-700/60">Segment (optional)</label>
          <select value={segmentId} onChange={(e) => setSegmentId(e.target.value)} className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm">
            <option value="">— alle —</option>
            {segments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={saving || !name.trim() || !url.trim()}
          className="rounded-lg bg-ink-900 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Anlegen
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
