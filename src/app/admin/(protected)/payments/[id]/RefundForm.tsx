"use client";

// CoachAdmin briefing §31 Refunds — amount + Zugang behalten/entfernen +
// Grund, all required (same postAction()-style pattern as
// CorrectivePlanActions/AppointmentActions elsewhere in this project).
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function RefundForm({ paymentId, maxAmountCents }: { paymentId: string; maxAmountCents: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(() => (maxAmountCents / 100).toFixed(2));
  const [keepAccess, setKeepAccess] = useState(true);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: Math.round(Number(amount || "0") * 100),
          keepAccess,
          reason,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Refund fehlgeschlagen.");
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (maxAmountCents <= 0) return null;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-red-200 text-red-700 px-4 py-2 text-sm font-semibold hover:bg-red-50">
        Refund erfassen
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-red-200 bg-red-50/40 p-4 flex flex-col gap-3">
      <p className="text-sm font-semibold text-ink-900">Refund erfassen</p>
      <label className="text-xs text-ink-700/60">
        Betrag (€)
        <input
          type="number"
          step="0.01"
          min={0}
          max={maxAmountCents / 100}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 block w-32 rounded-lg border border-ink-900/15 px-2 py-1.5 text-sm"
        />
      </label>
      <div className="flex gap-4 text-sm text-ink-700">
        <label className="flex items-center gap-2">
          <input type="radio" name="keepAccess" checked={keepAccess} onChange={() => setKeepAccess(true)} />
          Zugang behalten
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="keepAccess" checked={!keepAccess} onChange={() => setKeepAccess(false)} />
          Zugang entfernen
        </label>
      </div>
      <label className="text-xs text-ink-700/60">
        Grund (Pflichtfeld)
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="z. B. Kunde storniert Restpaket"
          className="mt-1 block w-full rounded-lg border border-ink-900/15 px-2 py-1.5 text-sm"
        />
      </label>
      <p className="text-xs text-ink-700/50">
        Bereits verbrauchte Einheiten bleiben bei „Zugang entfernen“ in der Historie erhalten — nur das verbleibende
        Kontingent wird deaktiviert.
      </p>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving || !reason.trim() || !amount} className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">
          {saving ? "Speichert…" : "Refund bestätigen"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-ink-700/60 underline">
          Abbrechen
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </form>
  );
}
