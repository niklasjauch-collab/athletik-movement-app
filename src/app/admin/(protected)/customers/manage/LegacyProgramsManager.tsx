"use client";

// CoachAdmin briefing §10 — named legacy programs, assignable to
// individual customers on their Einstellungen tab. Edit/delete for
// individual legacy programs isn't built yet in this pass (creation +
// assignment covers the core requirement); see the status report for
// this as a known follow-up.
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

type LegacyProgram = {
  id: string;
  name: string;
  oldPriceNote: string | null;
  oldBookingLinkUrl: string | null;
  oldPackageSizeNote: string | null;
  conditionsNote: string | null;
  hideNewProducts: boolean;
};

export default function LegacyProgramsManager({ legacyPrograms }: { legacyPrograms: LegacyProgram[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [oldPriceNote, setOldPriceNote] = useState("");
  const [oldBookingLinkUrl, setOldBookingLinkUrl] = useState("");
  const [oldPackageSizeNote, setOldPackageSizeNote] = useState("");
  const [conditionsNote, setConditionsNote] = useState("");
  const [hideNewProducts, setHideNewProducts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/legacy-programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, oldPriceNote, oldBookingLinkUrl, oldPackageSizeNote, conditionsNote, hideNewProducts }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Legacy-Programm konnte nicht erstellt werden.");
        return;
      }
      setName("");
      setOldPriceNote("");
      setOldBookingLinkUrl("");
      setOldPackageSizeNote("");
      setConditionsNote("");
      setHideNewProducts(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <ul className="flex flex-col gap-2">
        {legacyPrograms.length === 0 && <li className="text-sm text-ink-700/50">Noch keine Legacy-Programme.</li>}
        {legacyPrograms.map((lp) => (
          <li key={lp.id} className="rounded-lg border border-ink-900/10 p-3">
            <p className="text-sm font-medium text-ink-900">{lp.name}</p>
            <p className="text-xs text-ink-700/50">
              {[lp.oldPriceNote, lp.oldPackageSizeNote, lp.conditionsNote].filter(Boolean).join(" · ") || "—"}
            </p>
          </li>
        ))}
      </ul>

      <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name, z. B. Legacy 2024"
            className="flex-1 min-w-[160px] rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={oldPriceNote}
            onChange={(e) => setOldPriceNote(e.target.value)}
            placeholder="Alter Preis (Notiz)"
            className="flex-1 min-w-[160px] rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={oldPackageSizeNote}
            onChange={(e) => setOldPackageSizeNote(e.target.value)}
            placeholder="Alte Paketgröße (Notiz)"
            className="flex-1 min-w-[160px] rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
          />
        </div>
        <input
          type="url"
          value={oldBookingLinkUrl}
          onChange={(e) => setOldBookingLinkUrl(e.target.value)}
          placeholder="Alter Calendly-Link (optional)"
          className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
        />
        <textarea
          value={conditionsNote}
          onChange={(e) => setConditionsNote(e.target.value)}
          rows={2}
          placeholder="Weitere alte Bedingungen (optional)"
          className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" checked={hideNewProducts} onChange={(e) => setHideNewProducts(e.target.checked)} />
          Neue Produkte für diese Kunden ausblenden
        </label>
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="self-start rounded-lg bg-ink-900 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Anlegen
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
