import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import RefundForm from "./RefundForm";

export const dynamic = "force-dynamic";

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

function euro(cents: number) {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

// CoachAdmin briefing §28/§29/§31 — one payment's full detail (mirrors
// Listenpreis/Rabatt/tatsächlich bezahlt/Zahlungsart/Status/Stripe-ID from
// §28's own list) plus the refund action. §29's optional "IN STRIPE
// ÖFFNEN" button is only shown once a stripePaymentId exists — building a
// real Stripe Dashboard deep link needs the connected Stripe account id,
// which isn't configured in this environment (see status doc).
export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const provider = await getActiveProvider();

  const payment = await prisma.payment.findFirst({
    where: { id, providerId: provider.id },
    include: {
      client: { select: { id: true, firstName: true, lastName: true, email: true } },
      product: { select: { name: true } },
      entitlement: { select: { id: true, label: true, active: true } },
      refunds: { orderBy: { refundedAt: "desc" }, include: { refundedByAdmin: { select: { name: true } } } },
      createdByAdmin: { select: { name: true } },
    },
  });
  if (!payment) notFound();

  /* eslint-disable @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */
  const p = payment as any;
  const alreadyRefunded = p.refunds.reduce((sum: number, r: any) => sum + r.amountCents, 0);
  const remaining = p.amountCents - alreadyRefunded;

  return (
    <main className="flex-1 px-6 py-10 max-w-3xl mx-auto">
      <p className="text-sm text-ink-700/50">
        <Link href="/admin/payments" className="hover:underline">
          ← Zahlungen
        </Link>
      </p>
      <h1 className="mt-2 font-serif text-3xl font-bold text-ink-900">
        {p.product?.name ?? "Zahlung"}
      </h1>
      <p className="mt-1 text-sm text-ink-700/70">
        <Link href={`/admin/customers/${p.client.id}`} className="text-brand-700 hover:underline">
          {p.client.firstName} {p.client.lastName}
        </Link>{" "}
        · {p.client.email}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-ink-900/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Übersicht</p>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            <div className="flex justify-between"><dt className="text-ink-700/60">Datum</dt><dd>{new Date(p.paidAt).toLocaleDateString("de-DE")}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-700/60">Listenpreis</dt><dd>{euro(p.listPriceCents)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-700/60">Rabatt</dt><dd>{euro(p.discountCents)}</dd></div>
            <div className="flex justify-between font-semibold"><dt>Tatsächlich bezahlt</dt><dd>{euro(p.amountCents)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-700/60">Zahlungsart</dt><dd>{METHOD_LABELS[p.method] ?? p.method}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-700/60">Status</dt><dd>{STATUS_LABELS[p.status] ?? p.status}</dd></div>
            {p.stripePaymentId && (
              <div className="flex justify-between"><dt className="text-ink-700/60">Stripe-ID</dt><dd className="font-mono text-xs">{p.stripePaymentId}</dd></div>
            )}
            {p.note && <div className="flex justify-between"><dt className="text-ink-700/60">Notiz</dt><dd className="text-right max-w-[60%]">{p.note}</dd></div>}
            {p.createdByAdmin && <div className="flex justify-between"><dt className="text-ink-700/60">Erfasst von</dt><dd>{p.createdByAdmin.name}</dd></div>}
          </dl>
        </div>

        <div className="rounded-xl border border-ink-900/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Kontingent</p>
          {p.entitlement ? (
            <p className="mt-3 text-sm">
              <Link href={`/admin/customers/${p.client.id}?tab=kontingente`} className="text-brand-700 hover:underline">
                {p.entitlement.label}
              </Link>{" "}
              {!p.entitlement.active && <span className="text-ink-700/40">(deaktiviert)</span>}
            </p>
          ) : (
            <p className="mt-3 text-sm text-ink-700/50">Diese Zahlung hat kein verknüpftes Kontingent.</p>
          )}
        </div>
      </div>

      <section className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
          Refunds {p.refunds.length > 0 && `(${euro(alreadyRefunded)} von ${euro(p.amountCents)} bereits erstattet)`}
        </p>
        {p.refunds.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {p.refunds.map((r: any) => (
              <li key={r.id} className="rounded-lg border border-ink-900/10 p-3 text-sm flex flex-wrap justify-between gap-2">
                <span>
                  {euro(r.amountCents)} — {r.keepAccess ? "Zugang behalten" : "Zugang entfernt"} — {r.reason}
                </span>
                <span className="text-ink-700/40 text-xs">
                  {new Date(r.refundedAt).toLocaleDateString("de-DE")}
                  {r.refundedByAdmin ? ` · ${r.refundedByAdmin.name}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          <RefundForm paymentId={p.id} maxAmountCents={remaining} />
        </div>
      </section>
    </main>
  );
}
