"use client";

// CoachAdmin briefing §28/§30 — Zahlungen-Tab. "Zahlung manuell hinzufügen"
// lives here (client preselected); refunding an existing payment happens
// on its own /admin/payments/[id] detail page (kept out of this panel to
// avoid duplicating the refund form in two places — same reasoning as
// why CorrectivePlanActions is shared rather than re-implemented per view).
import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const METHOD_LABELS: Record<string, string> = {
  STRIPE: "Stripe",
  BANK_TRANSFER: "Banküberweisung",
  CASH: "Barzahlung",
  EXTERNAL_INVOICE: "Rechnung extern",
  GOODWILL: "Kulanz",
  FREE: "Kostenlos",
};

const STATUS_LABELS: Record<string, string> = {
  PAID: "Bezahlt",
  PENDING: "Ausstehend",
  FAILED: "Fehlgeschlagen",
  REFUNDED: "Erstattet",
  PARTIALLY_REFUNDED: "Teilweise erstattet",
  COMPLIMENTARY: "Kulanz/kostenlos",
  MANUAL: "Manuell (unklassifiziert)",
};

const STATUS_BADGE: Record<string, string> = {
  PAID: "bg-brand-100 text-brand-700",
  PENDING: "bg-amber-100 text-amber-700",
  FAILED: "bg-red-100 text-red-700",
  REFUNDED: "bg-slate-200 text-slate-600",
  PARTIALLY_REFUNDED: "bg-amber-100 text-amber-700",
  COMPLIMENTARY: "bg-sky-100 text-sky-700",
  MANUAL: "bg-ink-900/10 text-ink-900/60",
};

type Payment = {
  id: string;
  productName: string | null;
  listPriceCents: number;
  discountCents: number;
  amountCents: number;
  method: string;
  status: string;
  note: string | null;
  paidAt: string;
};

type ProductOption = { id: string; name: string; priceCents: number; credits: number | null };

function euro(cents: number) {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function NewPaymentForm({ clientId, products, onDone }: { clientId: string; products: ProductOption[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [listPrice, setListPrice] = useState("");
  const [discount, setDiscount] = useState("0");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [note, setNote] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [grantCredits, setGrantCredits] = useState("");
  const [grantUnlimited, setGrantUnlimited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickProduct(id: string) {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    if (p) {
      if (!listPrice) setListPrice(String(p.priceCents / 100));
      if (!amount) setAmount(String(p.priceCents / 100));
      if (p.credits && !grantCredits) setGrantCredits(String(p.credits));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const chosenProduct = products.find((p) => p.id === productId);
      const res = await fetch(`/api/admin/customers/${clientId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: productId || null,
          listPriceCents: Math.round(Number(listPrice || "0") * 100),
          discountCents: Math.round(Number(discount || "0") * 100),
          amountCents: Math.round(Number(amount || "0") * 100),
          method,
          note: note || null,
          paidAt: new Date(paidAt).toISOString(),
          grantCredits: grantCredits ? Number(grantCredits) : 0,
          grantUnlimited,
          grantLabel: chosenProduct?.name ?? "",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Zahlung konnte nicht erfasst werden.");
        return;
      }
      setProductId("");
      setListPrice("");
      setDiscount("0");
      setAmount("");
      setNote("");
      setGrantCredits("");
      setGrantUnlimited(false);
      setOpen(false);
      onDone();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-ink-900 text-white px-4 py-2 text-sm font-semibold">
        Zahlung manuell hinzufügen
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-ink-900/10 p-4 flex flex-col gap-3">
      <p className="text-sm font-semibold text-ink-900">Zahlung manuell hinzufügen</p>
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
                {p.name} ({euro(p.priceCents)})
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-ink-700/60">
          Zahlungsart
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 block rounded-lg border border-ink-900/15 px-2 py-1.5 text-sm">
            {Object.entries(METHOD_LABELS)
              .filter(([k]) => k !== "STRIPE")
              .map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
          </select>
        </label>
        <label className="text-xs text-ink-700/60">
          Datum
          <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className="mt-1 block rounded-lg border border-ink-900/15 px-2 py-1.5 text-sm" />
        </label>
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="text-xs text-ink-700/60">
          Listenpreis (€)
          <input type="number" step="0.01" value={listPrice} onChange={(e) => setListPrice(e.target.value)} className="mt-1 block w-28 rounded-lg border border-ink-900/15 px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-ink-700/60">
          Rabatt (€)
          <input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} className="mt-1 block w-28 rounded-lg border border-ink-900/15 px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-ink-700/60">
          Tatsächlich bezahlt (€)
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 block w-28 rounded-lg border border-ink-900/15 px-2 py-1.5 text-sm" />
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-lg bg-ink-900/[0.03] p-3">
        <p className="w-full text-xs text-ink-700/60">Optional: gleichzeitig ein Kontingent vergeben (§30 „danach entsprechendes Entitlement erstellen“)</p>
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" checked={grantUnlimited} onChange={(e) => setGrantUnlimited(e.target.checked)} />
          Unbegrenzt
        </label>
        {!grantUnlimited && (
          <label className="text-xs text-ink-700/60">
            Einheiten
            <input type="number" min={0} value={grantCredits} onChange={(e) => setGrantCredits(e.target.value)} className="mt-1 block w-24 rounded-lg border border-ink-900/15 px-2 py-1.5 text-sm" />
          </label>
        )}
      </div>
      <label className="text-xs text-ink-700/60">
        Notiz (optional)
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. bar bei Termin bezahlt" className="mt-1 block w-full rounded-lg border border-ink-900/15 px-2 py-1.5 text-sm" />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving || !amount} className="rounded-lg bg-ink-900 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">
          {saving ? "Speichert…" : "Zahlung speichern"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-ink-700/60 underline">
          Abbrechen
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </form>
  );
}

export default function PaymentPanel({ clientId, payments, products }: { clientId: string; payments: Payment[]; products: ProductOption[] }) {
  const router = useRouter();
  const onChanged = () => router.refresh();

  return (
    <div className="flex flex-col gap-6">
      <NewPaymentForm clientId={clientId} products={products} onDone={onChanged} />

      {payments.length === 0 ? (
        <p className="text-sm text-ink-700/50">Noch keine Zahlungen erfasst.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {payments.map((p) => (
            <li key={p.id} className="rounded-lg border border-ink-900/10 p-3 text-sm flex flex-wrap items-center justify-between gap-2">
              <div>
                <Link href={`/admin/payments/${p.id}`} className="font-medium text-ink-900 hover:underline">
                  {p.productName ?? "Zahlung"}
                </Link>
                <p className="text-xs text-ink-700/50">
                  {new Date(p.paidAt).toLocaleDateString("de-DE")} · {METHOD_LABELS[p.method] ?? p.method}
                  {p.note ? ` · ${p.note}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink-900">{euro(p.amountCents)}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[p.status] ?? "bg-ink-900/10"}`}>
                  {STATUS_LABELS[p.status] ?? p.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
