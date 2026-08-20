"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Product = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  priceCents: number;
  currency: string;
  credits: number | null;
  validityDays: number | null;
  stripePriceId: string | null;
  active: boolean;
  visibility: string;
  visibleToCustomers: boolean;
};

const TYPE_OPTIONS = [
  { value: "COACHING_SESSION", label: "Einzelsession" },
  { value: "COACHING_PACKAGE", label: "Paket" },
  { value: "SMARTMOTION_SCAN", label: "SmartMotionScan" },
  { value: "DIGITAL_TRAINING_PLAN", label: "Digitaler Trainingsplan" },
  { value: "COMPLIMENTARY", label: "Kulanz / kostenlos" },
];

const VISIBILITY_OPTIONS = [
  { value: "ALL", label: "Für alle" },
  { value: "SEGMENTS", label: "Nur ausgewählte Segmente" },
  { value: "CUSTOMERS", label: "Nur einzelne Kunden" },
];

export default function ProductEditForm({ product }: { product: Product }) {
  const router = useRouter();
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? "");
  const [type, setType] = useState(product.type);
  const [priceEuro, setPriceEuro] = useState(String(product.priceCents / 100));
  const [credits, setCredits] = useState(product.credits != null ? String(product.credits) : "");
  const [validityDays, setValidityDays] = useState(product.validityDays != null ? String(product.validityDays) : "");
  const [stripePriceId, setStripePriceId] = useState(product.stripePriceId ?? "");
  const [active, setActive] = useState(product.active);
  const [visibleToCustomers, setVisibleToCustomers] = useState(product.visibleToCustomers);
  const [visibility, setVisibility] = useState(product.visibility);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          type,
          priceCents: Math.round(parseFloat(priceEuro.replace(",", ".") || "0") * 100),
          credits: credits ? parseInt(credits, 10) : null,
          validityDays: validityDays ? parseInt(validityDays, 10) : null,
          stripePriceId: stripePriceId || null,
          active,
          visibleToCustomers,
          visibility,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-ink-900/10 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-ink-700/60">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm text-ink-900" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-700/60">
          Typ
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm text-ink-900">
            {TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-700/60">
          Preis (€)
          <input value={priceEuro} onChange={(e) => setPriceEuro(e.target.value)} inputMode="decimal" className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm text-ink-900" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-700/60">
          Credits (nur Pakete)
          <input value={credits} onChange={(e) => setCredits(e.target.value)} inputMode="numeric" className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm text-ink-900" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-700/60">
          Gültigkeit (Tage, leer = unbegrenzt)
          <input value={validityDays} onChange={(e) => setValidityDays(e.target.value)} inputMode="numeric" className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm text-ink-900" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-700/60">
          Stripe Price ID (optional, P7)
          <input value={stripePriceId} onChange={(e) => setStripePriceId(e.target.value)} className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm text-ink-900" />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-xs text-ink-700/60">
        Beschreibung
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm text-ink-900"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-ink-700/60">
          Sichtbarkeit (§25)
          <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm text-ink-900">
            {VISIBILITY_OPTIONS.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col justify-end gap-2 text-sm text-ink-900">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Aktiv
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={visibleToCustomers} onChange={(e) => setVisibleToCustomers(e.target.checked)} />
            Für Kunden sichtbar
          </label>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="rounded-lg bg-ink-900 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Speichern
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
