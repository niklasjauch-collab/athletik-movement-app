"use client";

// CoachAdmin briefing §8 (Beta Tester) + §9 (Freunde/Family) — "Zugang
// verwalten." Explicit constraint from the briefing: a grant is never
// implied by segment membership, the coach picks item-by-item what's
// unlocked — hence every field here is its own checkbox/input, no "grant
// everything" shortcut.
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

type Grant = {
  validFrom: string | null;
  validUntil: string | null;
  appAccessGranted: boolean;
  scanResultAccessGranted: boolean;
  allProductsGranted: boolean;
  coachingAccessNote: string | null;
  sessionsGranted: number | null;
  sessionsUnlimited: boolean;
  specialBookingLinkUrl: string | null;
  note: string | null;
} | null;

function toInputDate(v: string | null) {
  return v ? v.slice(0, 10) : "";
}

export default function AccessGrantForm({ clientId, grant }: { clientId: string; grant: Grant }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [validFrom, setValidFrom] = useState(toInputDate(grant?.validFrom ?? null));
  const [validUntil, setValidUntil] = useState(toInputDate(grant?.validUntil ?? null));
  const [appAccessGranted, setAppAccessGranted] = useState(grant?.appAccessGranted ?? false);
  const [scanResultAccessGranted, setScanResultAccessGranted] = useState(grant?.scanResultAccessGranted ?? false);
  const [allProductsGranted, setAllProductsGranted] = useState(grant?.allProductsGranted ?? false);
  const [coachingAccessNote, setCoachingAccessNote] = useState(grant?.coachingAccessNote ?? "");
  const [sessionsGranted, setSessionsGranted] = useState(grant?.sessionsGranted?.toString() ?? "");
  const [sessionsUnlimited, setSessionsUnlimited] = useState(grant?.sessionsUnlimited ?? false);
  const [specialBookingLinkUrl, setSpecialBookingLinkUrl] = useState(grant?.specialBookingLinkUrl ?? "");
  const [note, setNote] = useState(grant?.note ?? "");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`/api/admin/customers/${clientId}/access-grant`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          validFrom: validFrom || null,
          validUntil: validUntil || null,
          appAccessGranted,
          scanResultAccessGranted,
          allProductsGranted,
          coachingAccessNote: coachingAccessNote || null,
          sessionsGranted: sessionsGranted ? Number(sessionsGranted) : null,
          sessionsUnlimited,
          specialBookingLinkUrl: specialBookingLinkUrl || null,
          note: note || null,
        }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        <label className="text-sm text-ink-700">
          Zugang ab
          <input
            type="date"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            className="mt-1 block rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm text-ink-700">
          Zugang bis (leer = unbegrenzt)
          <input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="mt-1 block rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" checked={appAccessGranted} onChange={(e) => setAppAccessGranted(e.target.checked)} />
          App-Zugang freigeben
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={scanResultAccessGranted}
            onChange={(e) => setScanResultAccessGranted(e.target.checked)}
          />
          SmartMotionScan-Ergebnis freigeben
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" checked={allProductsGranted} onChange={(e) => setAllProductsGranted(e.target.checked)} />
          Alle Trainingspläne freigeben
        </label>
      </div>

      <label className="text-sm text-ink-700">
        Coaching-Zugang
        <input
          type="text"
          value={coachingAccessNote}
          onChange={(e) => setCoachingAccessNote(e.target.value)}
          placeholder='z. B. "kostenlos", "vergünstigt 50%", "kein Coaching enthalten"'
          className="mt-1 block w-full rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
        />
      </label>

      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm text-ink-700">
          Kostenlose Termine
          <input
            type="number"
            min={0}
            value={sessionsGranted}
            disabled={sessionsUnlimited}
            onChange={(e) => setSessionsGranted(e.target.value)}
            className="mt-1 block w-28 rounded-lg border border-ink-900/15 px-3 py-2 text-sm disabled:opacity-40"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-700 pb-2">
          <input type="checkbox" checked={sessionsUnlimited} onChange={(e) => setSessionsUnlimited(e.target.checked)} />
          unbegrenzt
        </label>
      </div>

      <label className="text-sm text-ink-700">
        Spezieller Buchungslink
        <input
          type="url"
          value={specialBookingLinkUrl}
          onChange={(e) => setSpecialBookingLinkUrl(e.target.value)}
          placeholder="https://calendly.com/…"
          className="mt-1 block w-full rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
        />
      </label>

      <label className="text-sm text-ink-700">
        Interne Notiz
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder='z. B. "Beta Tester App Version 1"'
          className="mt-1 block w-full rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
        />
      </label>

      <button
        type="submit"
        disabled={saving}
        className="self-start rounded-lg bg-ink-900 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
      >
        {saving ? "Speichert…" : "Zugang speichern"}
      </button>
    </form>
  );
}
