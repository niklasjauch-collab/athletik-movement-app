"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

type Link = {
  id: string;
  name: string;
  url: string;
  type: string | null;
  active: boolean;
  segment: { id: string; name: string } | null;
};
type Segment = { id: string; name: string };

export default function ProductBookingLinksManager({
  productId,
  links,
  segments,
}: {
  productId: string;
  links: Link[];
  segments: Segment[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
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
        body: JSON.stringify({ name, url, productId, segmentId: segmentId || undefined, type: segmentId ? "Segment" : "Standard" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Buchungslink konnte nicht angelegt werden.");
        return;
      }
      setName("");
      setUrl("");
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

  return (
    <div>
      {links.length === 0 ? (
        <p className="text-sm text-ink-700/50">Noch kein produktspezifischer Buchungslink.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {links.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 rounded-lg border border-ink-900/10 p-3 text-sm">
              <div>
                <p className="font-medium text-ink-900">
                  {l.name} {l.segment && <span className="text-xs text-ink-700/50">(Segment: {l.segment.name})</span>}
                </p>
                <p className="text-xs text-ink-700/50 break-all">{l.url}</p>
              </div>
              <button
                type="button"
                onClick={() => toggleActive(l.id, l.active)}
                className={`text-xs shrink-0 rounded-full px-2 py-0.5 ${l.active ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-500"}`}
              >
                {l.active ? "Aktiv" : "Inaktiv"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleCreate} className="mt-4 flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-700/60">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Beta Coaching" className="min-w-[160px] rounded-lg border border-ink-900/15 px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-700/60">Calendly-URL</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://calendly.com/…" className="min-w-[220px] rounded-lg border border-ink-900/15 px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-700/60">Nur für Segment (optional)</label>
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
