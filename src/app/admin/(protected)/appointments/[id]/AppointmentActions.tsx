"use client";

// CoachAdmin briefing §21 UNMATCHED BOOKINGS + §23 TERMINDETAILS — every
// button/form on the appointment detail page posts to the single
// discriminated action route (src/app/api/admin/appointments/[id]/action/
// route.ts), then router.refresh() re-reads the server component so the
// status/credit numbers shown are always server-computed, never guessed
// client-side. Same fetch → refresh pattern as EntitlementsPanel.tsx.
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

type ClientOption = { id: string; firstName: string; lastName: string; email: string };
type ProductOption = { id: string; name: string; type: string };
type EntitlementOption = { id: string; label: string; productName: string | null; unlimited: boolean; available: number };

async function postAction(bookingId: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/admin/appointments/${bookingId}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Aktion fehlgeschlagen.");
  }
}

function ActionButton({
  label,
  tone = "default",
  onRun,
}: {
  label: string;
  tone?: "default" | "danger" | "muted";
  onRun: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleClick() {
    setSaving(true);
    setError(null);
    try {
      await onRun();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Aktion fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  const toneClasses =
    tone === "danger"
      ? "bg-red-600 text-white"
      : tone === "muted"
        ? "border border-ink-900/15 text-ink-900"
        : "bg-ink-900 text-white";

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={saving}
        onClick={handleClick}
        className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ${toneClasses}`}
      >
        {saving ? "Speichert…" : label}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function MatchClientForm({ bookingId, clients }: { bookingId: string; clients: ClientOption[] }) {
  const [clientId, setClientId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!clientId) return;
    setSaving(true);
    setError(null);
    try {
      await postAction(bookingId, { action: "MATCH_CLIENT", clientId });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Zuordnung fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <label className="text-xs text-ink-700/60">
        Kunde zuordnen
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="mt-1 block min-w-[240px] rounded-lg border border-ink-900/15 px-2 py-1.5 text-sm"
        >
          <option value="">— Kunde wählen —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.firstName} {c.lastName} ({c.email})
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={saving || !clientId}
        className="rounded-lg bg-ink-900 text-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
      >
        {saving ? "Speichert…" : "Zuordnen"}
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}

function MatchProductForm({ bookingId, products }: { bookingId: string; products: ProductOption[] }) {
  const [productId, setProductId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!productId) return;
    setSaving(true);
    setError(null);
    try {
      await postAction(bookingId, { action: "MATCH_PRODUCT", productId });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Zuordnung fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <label className="text-xs text-ink-700/60">
        Produkt zuordnen
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="mt-1 block min-w-[240px] rounded-lg border border-ink-900/15 px-2 py-1.5 text-sm"
        >
          <option value="">— Produkt wählen —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={saving || !productId}
        className="rounded-lg bg-ink-900 text-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
      >
        {saving ? "Speichert…" : "Zuordnen"}
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}

function ReassignEntitlementForm({ bookingId, options }: { bookingId: string; options: EntitlementOption[] }) {
  const [entitlementId, setEntitlementId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await postAction(bookingId, { action: "REASSIGN_ENTITLEMENT", entitlementId: entitlementId || null });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Zuweisung fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <label className="text-xs text-ink-700/60">
        Kontingent zuweisen
        <select
          value={entitlementId}
          onChange={(e) => setEntitlementId(e.target.value)}
          className="mt-1 block min-w-[240px] rounded-lg border border-ink-900/15 px-2 py-1.5 text-sm"
        >
          <option value="">— kein Kontingent —</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.productName ?? o.label} {o.unlimited ? "(unbegrenzt)" : `(${o.available} verfügbar)`}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-ink-900 text-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
      >
        {saving ? "Speichert…" : "Übernehmen"}
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}

export default function AppointmentActions({
  bookingId,
  status,
  hasClient,
  hasProduct,
  hasEntitlement,
  complimentary,
  clients,
  products,
  clientEntitlements,
}: {
  bookingId: string;
  status: string;
  hasClient: boolean;
  hasProduct: boolean;
  hasEntitlement: boolean;
  complimentary: boolean;
  clients: ClientOption[];
  products: ProductOption[];
  clientEntitlements: EntitlementOption[];
}) {
  const isOpen = status === "CONFIRMED";

  return (
    <div className="flex flex-col gap-8">
      {isOpen && (
        <div className="rounded-xl border border-ink-900/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/40">Termin abschließen</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <ActionButton label="Durchgeführt" onRun={() => postAction(bookingId, { action: "COMPLETE" })} />
            <ActionButton label="No Show" tone="danger" onRun={() => postAction(bookingId, { action: "NO_SHOW" })} />
            {hasEntitlement && (
              <ActionButton
                label="Kontingent nicht belasten"
                tone="muted"
                onRun={() => postAction(bookingId, { action: "SKIP_CREDIT" })}
              />
            )}
            {!complimentary && (
              <ActionButton
                label="Als kostenlos markieren"
                tone="muted"
                onRun={() => postAction(bookingId, { action: "MARK_COMPLIMENTARY" })}
              />
            )}
          </div>
        </div>
      )}

      {(!hasClient || !hasProduct) && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Nicht zugeordnet</p>
          <p className="mt-1 text-sm text-amber-800">
            §21 — dieser Termin konnte beim Import nicht automatisch vollständig zugeordnet werden. Bitte manuell nachtragen.
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {!hasClient && <MatchClientForm bookingId={bookingId} clients={clients} />}
            {!hasProduct && <MatchProductForm bookingId={bookingId} products={products} />}
          </div>
        </div>
      )}

      {hasClient && (
        <div className="rounded-xl border border-ink-900/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/40">Kontingent-Zuordnung</p>
          <p className="mt-1 text-sm text-ink-700/60">
            Falls das automatisch (oder zuletzt manuell) gewählte Kontingent nicht passt, hier ein anderes des Kunden wählen.
          </p>
          <div className="mt-3">
            <ReassignEntitlementForm bookingId={bookingId} options={clientEntitlements} />
          </div>
        </div>
      )}
    </div>
  );
}
