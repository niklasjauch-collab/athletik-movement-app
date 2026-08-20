import Link from "next/link";
import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import CreateProductForm from "./CreateProductForm";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  COACHING_SESSION: "Einzelsession",
  COACHING_PACKAGE: "Paket",
  SMARTMOTION_SCAN: "SmartMotionScan",
  DIGITAL_TRAINING_PLAN: "Digitaler Trainingsplan",
  COMPLIMENTARY: "Kulanz / kostenlos",
};

function formatPrice(cents: number, currency: string) {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency });
}

// CoachAdmin briefing §24 PRODUKTVERWALTUNG. Sonderpreise (§26) und
// Sichtbarkeitsregeln (§25) werden auf der Detailseite gepflegt, nicht
// hier — die Liste bleibt bewusst schlank (§63 Admin-Dichte ohne
// unübersichtliche Tabellen).
export default async function ProductsPage() {
  const provider = await getActiveProvider();
  const products = await prisma.product.findMany({
    where: { providerId: provider.id },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { prices: true, accessRules: true, bookingLinks: true } } },
  });

  return (
    <main className="flex-1 px-6 py-10 max-w-5xl mx-auto">
      <p className="text-sm text-ink-700/50">
        <Link href="/admin" className="hover:underline">
          ← Dashboard
        </Link>
      </p>
      <h1 className="mt-2 font-serif text-3xl font-bold text-ink-900">Produkte</h1>
      <p className="mt-1 text-sm text-ink-700/70">
        {products.length} Produkt{products.length !== 1 ? "e" : ""}. Sonderpreise, Sichtbarkeit und Buchungslinks
        pro Produkt in der Detailansicht.{" "}
        <Link href="/admin/booking-links" className="underline hover:text-brand-700">
          Alle Buchungslinks verwalten
        </Link>
      </p>

      {products.length === 0 ? (
        <p className="mt-10 text-sm text-ink-700/60">Noch keine Produkte angelegt.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-ink-900/10">
          <table className="w-full text-sm">
            <thead className="bg-ink-900/5 text-left text-xs uppercase tracking-wide text-ink-900/50">
              <tr>
                <th className="px-4 py-3">Produkt</th>
                <th className="px-4 py-3">Typ</th>
                <th className="px-4 py-3">Preis</th>
                <th className="px-4 py-3">Credits</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-900/5">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
              {products.map((p: any) => (
                <tr key={p.id} className="hover:bg-ink-900/[0.03]">
                  <td className="px-4 py-3">
                    <Link href={`/admin/products/${p.id}`} className="font-medium text-ink-900 hover:underline">
                      {p.name}
                    </Link>
                    <p className="text-xs text-ink-700/50">
                      {p._count.prices > 0 && `${p._count.prices} Sonderpreis(e) · `}
                      {p._count.bookingLinks > 0 && `${p._count.bookingLinks} Buchungslink(s)`}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-ink-700/70">{TYPE_LABELS[p.type] ?? p.type}</td>
                  <td className="px-4 py-3 text-ink-700/70">{formatPrice(p.priceCents, p.currency)}</td>
                  <td className="px-4 py-3 text-ink-700/70">{p.credits ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.active && p.visibleToCustomers
                          ? "bg-brand-100 text-brand-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {!p.active ? "Inaktiv" : !p.visibleToCustomers ? "Ausgeblendet" : "Aktiv"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="mt-10">
        <h2 className="font-semibold text-lg text-ink-900">Neues Produkt anlegen</h2>
        <div className="mt-3">
          <CreateProductForm />
        </div>
      </section>
    </main>
  );
}
