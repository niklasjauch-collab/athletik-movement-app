import Link from "next/link";
import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";

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
  MANUAL: "Manuell",
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

function euro(cents: number) {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

// CoachAdmin briefing §28 ZAHLUNGEN — cross-customer list, same columns
// as the briefing's own table (Datum/Kunde/Produkt/Listenpreis/Rabatt/
// tatsächlich bezahlt/Zahlungsart/Status/Stripe-ID). Neue Zahlungen werden
// bewusst nicht hier, sondern auf der Kundendetailseite erfasst (siehe
// PaymentPanel.tsx) — ein Kunde muss dafür ohnehin ausgewählt sein, ein
// zweites, redundantes globales Formular hätte hier keinen echten
// Mehrwert; "+ Zahlung" in den späteren Quick Actions (P8) verlinkt
// deshalb direkt auf die Kundendetailseite.
export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const statusFilter = sp.status ?? "";
  const methodFilter = sp.method ?? "";

  const provider = await getActiveProvider();

  const payments = await prisma.payment.findMany({
    where: { providerId: provider.id },
    orderBy: { paidAt: "desc" },
    include: {
      client: { select: { id: true, firstName: true, lastName: true, email: true } },
      product: { select: { name: true } },
    },
    take: 500,
  });

  /* eslint-disable @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */
  const rows = payments
    .filter((p: any) => !statusFilter || p.status === statusFilter)
    .filter((p: any) => !methodFilter || p.method === methodFilter)
    .filter((p: any) => {
      if (!q) return true;
      const name = `${p.client.firstName} ${p.client.lastName} ${p.client.email} ${p.product?.name ?? ""}`.toLowerCase();
      return name.includes(q);
    });

  const totalCents = rows.reduce((sum: number, p: any) => sum + (["PAID", "PARTIALLY_REFUNDED"].includes(p.status) ? p.amountCents : 0), 0);

  return (
    <main className="flex-1 px-6 py-10 max-w-5xl mx-auto">
      <p className="text-sm text-ink-700/50">
        <Link href="/admin" className="hover:underline">
          ← Dashboard
        </Link>
      </p>
      <h1 className="mt-2 font-serif text-3xl font-bold text-ink-900">Zahlungen</h1>
      <p className="mt-1 text-sm text-ink-700/70">
        {rows.length} von {payments.length} Zahlung(en) · {euro(totalCents)} Umsatz in dieser Auswahl
      </p>

      <form className="mt-4 flex flex-wrap gap-3" method="get">
        <input
          type="text"
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Kunde, Produkt…"
          className="flex-1 min-w-[220px] rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
        />
        <select name="status" defaultValue={sp.status ?? ""} className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm">
          <option value="">Alle Status</option>
          {Object.entries(STATUS_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <select name="method" defaultValue={sp.method ?? ""} className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm">
          <option value="">Alle Zahlungsarten</option>
          {Object.entries(METHOD_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-ink-900 text-white px-4 py-2 text-sm font-semibold">
          Filtern
        </button>
        {(sp.q || sp.status || sp.method) && (
          <Link href="/admin/payments" className="text-sm text-ink-700/60 underline self-center">
            Zurücksetzen
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <p className="mt-10 text-sm text-ink-700/60">Keine Zahlung gefunden.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-ink-900/10">
          <table className="w-full text-sm">
            <thead className="bg-ink-900/5 text-left text-xs uppercase tracking-wide text-ink-900/50">
              <tr>
                <th className="px-4 py-3">Datum</th>
                <th className="px-4 py-3">Kunde</th>
                <th className="px-4 py-3">Produkt</th>
                <th className="px-4 py-3">Bezahlt</th>
                <th className="px-4 py-3">Zahlungsart</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-900/5">
              {rows.map((p: any) => (
                <tr key={p.id} className="hover:bg-ink-900/[0.03]">
                  <td className="px-4 py-3 text-ink-700/60">{new Date(p.paidAt).toLocaleDateString("de-DE")}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/customers/${p.client.id}`} className="font-medium text-ink-900 hover:underline">
                      {p.client.firstName} {p.client.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/payments/${p.id}`} className="text-brand-700 hover:underline">
                      {p.product?.name ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-medium">{euro(p.amountCents)}</td>
                  <td className="px-4 py-3 text-ink-700/70">{METHOD_LABELS[p.method] ?? p.method}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[p.status] ?? "bg-ink-900/10"}`}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
