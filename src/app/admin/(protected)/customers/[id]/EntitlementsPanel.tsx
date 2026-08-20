"use client";

// CoachAdmin briefing §11-§17 — Kontingente tab. Every number shown here
// (Gesamt/Verbraucht/Reserviert/Verfügbar) is server-computed by
// src/lib/creditLedger.ts from the entitlement's ledger, never a value
// this component invents or edits directly — every change goes through
// one of the three API routes below, each of which appends a new ledger
// row rather than mutating anything in place (§15).
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

const TYPE_LABELS: Record<string, string> = {
  PACKAGE_PURCHASE: "Kauf / Vergabe",
  BOOKING_RESERVED: "Termin reserviert",
  BOOKING_CANCELLED: "Reservierung storniert",
  SESSION_COMPLETED: "Einheit durchgeführt",
  MANUAL_ADJUSTMENT: "Manuelle Korrektur",
};

type LedgerEntry = {
  id: string;
  type: string;
  totalDelta: number;
  reservedDelta: number;
  consumedDelta: number;
  reason: string | null;
  createdAt: string;
  createdByAdmin: { name: string } | null;
};

type Entitlement = {
  id: string;
  label: string;
  productName: string | null;
  unlimited: boolean;
  active: boolean;
  expiresAt: string | null;
  source: string;
  createdAt: string;
  createdByAdmin: { name: string } | null;
  status: { total: number; reserved: number; consumed: number; available: number };
  ledgerEntries: LedgerEntry[];
};

type ProductOption = { id: string; name: string; credits: number | null };

function toInputDate(v: string | null) {
  return v ? v.slice(0, 10) : "";
}

function expiryTone(expiresAt: string | null): string {
  if (!expiresAt) return "text-ink-700/50";
  const days = (new Date(expiresAt).getTime() - Date.now()) / 86_400_000;
  if (days < 0) return "text-red-600";
  if (days < 30) return "text-amber-600";
  return "text-ink-700/50";
}

function AdjustForm({ clientId, entitlementId, onDone }: { clientId: string; entitlementId: string; onDone: () => void }) {
  const [bucket, setBucket] = useState<"TOTAL" | "CONSUMED">("TOTAL");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/customers/${clientId}/entitlements/${entitlementId}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket, delta: Number(delta), reason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Anpassung fehlgeschlagen.");
        return;
      }
      setDelta("");
      setReason("");
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-ink-900/[0.03] p-3">
      <label className="text-xs text-ink-700/60">
        Bucket
        <select
          value={bucket}
          onChange={(e) => setBucket(e.target.value as "TOTAL" | "CONSUMED")}
          className="mt-1 block rounded-lg border border-ink-900/15 px-2 py-1.5 text-sm"
        >
          <option value="TOTAL">Gesamt (z. B. +1 Kulanz, +5 Altbestand)</option>
          <option value="CONSUMED">Verbraucht (z. B. -1 manuell durchgeführt, -1 No Show)</option>
        </select>
      </label>
      <label className="text-xs text-ink-700/60">
        Wert
        <input
          type="number"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          placeholder="+1 oder -1"
          className="mt-1 block w-24 rounded-lg border border-ink-900/15 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="text-xs text-ink-700/60 flex-1 min-w-[180px]">
        Grund (Pflichtfeld)
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="z. B. Kulanz, No Show, Altbestand-Übertrag"
          className="mt-1 block w-full rounded-lg border border-ink-900/15 px-2 py-1.5 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={saving || !delta || !reason.trim()}
        className="rounded-lg bg-ink-900 text-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
      >
        {saving ? "Speichert…" : "Anpassen"}
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}

function EntitlementCard({ clientId, ent, onChanged }: { clientId: string; ent: Entitlement; onChanged: () => void }) {
  const [showAdjust, setShowAdjust] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showExpiry, setShowExpiry] = useState(false);
  const [expiryInput, setExpiryInput] = useState(toInputDate(ent.expiresAt));
  const [savingExpiry, setSavingExpiry] = useState(false);

  async function saveExpiry(value: string | null) {
    setSavingExpiry(true);
    try {
      await fetch(`/api/admin/customers/${clientId}/entitlements/${ent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresAt: value }),
      });
      onChanged();
      setShowExpiry(false);
    } finally {
      setSavingExpiry(false);
    }
  }

  return (
    <li className={`rounded-xl border p-4 ${ent.active ? "border-ink-900/10" : "border-ink-900/5 opacity-50"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-ink-900">
            {ent.productName ?? ent.label}
            {!ent.active && <span className="ml-2 text-xs text-ink-700/40">(archiviert)</span>}
          </p>
          {ent.productName && ent.productName !== ent.label && (
            <p className="text-xs text-ink-700/50">{ent.label}</p>
          )}
          <p className="mt-1 text-xs text-ink-700/40">
            Angelegt {new Date(ent.createdAt).toLocaleDateString("de-DE")}
            {ent.createdByAdmin ? ` von ${ent.createdByAdmin.name}` : ""} · Quelle: {ent.source}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {ent.unlimited ? (
            <span className="rounded-full bg-brand-50 text-brand-700 px-2 py-0.5 font-medium">Unbegrenzt</span>
          ) : (
            <>
              <span className="rounded-full bg-ink-900/5 px-2 py-0.5">Gesamt: {ent.status.total}</span>
              <span className="rounded-full bg-ink-900/5 px-2 py-0.5">Verbraucht: {ent.status.consumed}</span>
              <span className="rounded-full bg-ink-900/5 px-2 py-0.5">Reserviert: {ent.status.reserved}</span>
              <span className="rounded-full bg-brand-50 text-brand-700 px-2 py-0.5 font-semibold">
                Verfügbar: {ent.status.available}
              </span>
            </>
          )}
        </div>
      </div>

      <p className={`mt-2 text-xs ${expiryTone(ent.expiresAt)}`}>
        {ent.expiresAt
          ? `Läuft am ${new Date(ent.expiresAt).toLocaleDateString("de-DE")} ab`
          : "Kein Ablaufdatum"}
        <button type="button" onClick={() => setShowExpiry((v) => !v)} className="ml-2 underline">
          bearbeiten
        </button>
      </p>
      {showExpiry && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={expiryInput}
            onChange={(e) => setExpiryInput(e.target.value)}
            className="rounded-lg border border-ink-900/15 px-2 py-1 text-xs"
          />
          <button
            type="button"
            disabled={savingExpiry}
            onClick={() => saveExpiry(expiryInput || null)}
            className="rounded-lg bg-ink-900 text-white px-2 py-1 text-xs font-semibold disabled:opacity-50"
          >
            Speichern
          </button>
          {ent.expiresAt && (
            <button
              type="button"
              disabled={savingExpiry}
              onClick={() => {
                setExpiryInput("");
                saveExpiry(null);
              }}
              className="text-xs text-ink-700/60 underline"
            >
              Entfernen
            </button>
          )}
        </div>
      )}

      <div className="mt-3 flex gap-3 text-xs">
        {ent.active && !ent.unlimited && (
          <button type="button" onClick={() => setShowAdjust((v) => !v)} className="text-ink-700 underline">
            {showAdjust ? "Korrektur ausblenden" : "Kontingent anpassen"}
          </button>
        )}
        <button type="button" onClick={() => setShowHistory((v) => !v)} className="text-ink-700/60 underline">
          {showHistory ? "Verlauf ausblenden" : `Verlauf (${ent.ledgerEntries.length})`}
        </button>
      </div>

      {showAdjust && <AdjustForm clientId={clientId} entitlementId={ent.id} onDone={onChanged} />}

      {showHistory && (
        <ul className="mt-3 flex flex-col gap-1.5 border-t border-ink-900/10 pt-3">
          {ent.ledgerEntries.length === 0 && <li className="text-xs text-ink-700/40">Noch keine Einträge.</li>}
          {[...ent.ledgerEntries].reverse().map((e) => (
            <li key={e.id} className="text-xs text-ink-700/70 flex flex-wrap justify-between gap-2">
              <span>
                {TYPE_LABELS[e.type] ?? e.type}
                {e.totalDelta !== 0 && ` · Gesamt ${e.totalDelta > 0 ? "+" : ""}${e.totalDelta}`}
                {e.consumedDelta !== 0 && ` · Verbraucht ${e.consumedDelta > 0 ? "+" : ""}${e.consumedDelta}`}
                {e.reservedDelta !== 0 && ` · Reserviert ${e.reservedDelta > 0 ? "+" : ""}${e.reservedDelta}`}
                {e.reason && ` — ${e.reason}`}
              </span>
              <span className="text-ink-700/40 shrink-0">
                {new Date(e.createdAt).toLocaleDateString("de-DE")}
                {e.createdByAdmin ? ` · ${e.createdByAdmin.name}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function NewEntitlementForm({ clientId, products, onDone }: { clientId: string; products: ProductOption[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [label, setLabel] = useState("");
  const [unlimited, setUnlimited] = useState(false);
  const [totalCredits, setTotalCredits] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickProduct(id: string) {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    if (p) {
      if (!label) setLabel(p.name);
      if (p.credits && !totalCredits) setTotalCredits(String(p.credits));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/customers/${clientId}/entitlements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: productId || null,
          label: label || products.find((p) => p.id === productId)?.name || "Kontingent",
          unlimited,
          totalCredits: totalCredits ? Number(totalCredits) : 0,
          expiresAt: expiresAt || null,
          note: note || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Kontingent konnte nicht angelegt werden.");
        return;
      }
      setProductId("");
      setLabel("");
      setUnlimited(false);
      setTotalCredits("");
      setExpiresAt("");
      setNote("");
      setOpen(false);
      onDone();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-ink-900 text-white px-4 py-2 text-sm font-semibold"
      >
        Neues Kontingent vergeben
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-ink-900/10 p-4 flex flex-col gap-3">
      <p className="text-sm font-semibold text-ink-900">Neues Kontingent vergeben</p>
      <div className="flex flex-wrap gap-3">
        <label className="text-xs text-ink-700/60">
          Produkt (optional)
          <select
            value={productId}
            onChange={(e) => pickProduct(e.target.value)}
            className="mt-1 block min-w-[220px] rounded-lg border border-ink-900/15 px-2 py-1.5 text-sm"
          >
            <option value="">— kein Produkt / benutzerdefiniert —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.credits ? ` (${p.credits} Einheiten)` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-ink-700/60 flex-1 min-w-[180px]">
          Bezeichnung
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="z. B. Altbestand-Übertrag"
            className="mt-1 block w-full rounded-lg border border-ink-900/15 px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" checked={unlimited} onChange={(e) => setUnlimited(e.target.checked)} />
          Unbegrenzt
        </label>
        {!unlimited && (
          <label className="text-xs text-ink-700/60">
            Anzahl Einheiten
            <input
              type="number"
              min={1}
              value={totalCredits}
              onChange={(e) => setTotalCredits(e.target.value)}
              className="mt-1 block w-28 rounded-lg border border-ink-900/15 px-2 py-1.5 text-sm"
            />
          </label>
        )}
        <label className="text-xs text-ink-700/60">
          Ablaufdatum (optional)
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="mt-1 block rounded-lg border border-ink-900/15 px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      <label className="text-xs text-ink-700/60">
        Notiz (optional)
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="z. B. bar bezahlt am ..."
          className="mt-1 block w-full rounded-lg border border-ink-900/15 px-2 py-1.5 text-sm"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || (!unlimited && !totalCredits)}
          className="rounded-lg bg-ink-900 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Speichert…" : "Kontingent anlegen"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-ink-700/60 underline">
          Abbrechen
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </form>
  );
}

export default function EntitlementsPanel({
  clientId,
  entitlements,
  products,
}: {
  clientId: string;
  entitlements: Entitlement[];
  products: ProductOption[];
}) {
  const router = useRouter();
  const onChanged = () => router.refresh();

  return (
    <div className="flex flex-col gap-6">
      <NewEntitlementForm clientId={clientId} products={products} onDone={onChanged} />

      {entitlements.length === 0 ? (
        <p className="text-sm text-ink-700/50">Noch keine Kontingente vergeben.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {entitlements.map((ent) => (
            <EntitlementCard key={ent.id} clientId={clientId} ent={ent} onChanged={onChanged} />
          ))}
        </ul>
      )}
    </div>
  );
}
