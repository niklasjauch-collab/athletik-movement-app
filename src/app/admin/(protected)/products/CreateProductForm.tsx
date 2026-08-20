"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

const TYPE_OPTIONS = [
  { value: "COACHING_SESSION", label: "Einzelsession" },
  { value: "COACHING_PACKAGE", label: "Paket" },
  { value: "SMARTMOTION_SCAN", label: "SmartMotionScan" },
  { value: "DIGITAL_TRAINING_PLAN", label: "Digitaler Trainingsplan" },
  { value: "COMPLIMENTARY", label: "Kulanz / kostenlos" },
];

export default function CreateProductForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState("COACHING_SESSION");
  const [priceEuro, setPriceEuro] = useState("");
  const [credits, setCredits] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type,
          priceCents: Math.round(parseFloat(priceEuro.replace(",", ".") || "0") * 100),
          credits: type === "COACHING_PACKAGE" && credits ? parseInt(credits, 10) : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Produkt konnte nicht erstellt werden.");
        return;
      }
      setName("");
      setPriceEuro("");
      setCredits("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-700/60">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. Movement Coaching – 10er Paket"
          className="min-w-[220px] rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-700/60">Typ</label>
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm">
          {TYPE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-700/60">Preis (€)</label>
        <input
          type="text"
          inputMode="decimal"
          value={priceEuro}
          onChange={(e) => setPriceEuro(e.target.value)}
          placeholder="250"
          className="w-28 rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
        />
      </div>
      {type === "COACHING_PACKAGE" && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-700/60">Credits</label>
          <input
            type="text"
            inputMode="numeric"
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            placeholder="15"
            className="w-20 rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
          />
        </div>
      )}
      <button
        type="submit"
        disabled={saving || !name.trim() || !priceEuro}
        className="rounded-lg bg-ink-900 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
      >
        Anlegen
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
