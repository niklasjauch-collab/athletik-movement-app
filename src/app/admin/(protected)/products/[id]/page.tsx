import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import ProductEditForm from "./ProductEditForm";
import PricesManager from "./PricesManager";
import AccessRulesManager from "./AccessRulesManager";
import ProductBookingLinksManager from "./ProductBookingLinksManager";

export const dynamic = "force-dynamic";

// CoachAdmin briefing §24-§26/§18 — one product's full commercial
// configuration: base fields, Sonderpreise (§26), Sichtbarkeit (§25),
// and its own scoped Buchungslinks (§18). Kept as one page with
// sub-sections rather than separate tabs — the CoachAdmin briefing's
// customer-detail 9-tab pattern is for a much bigger, higher-traffic
// screen; a product's config is small enough to read in one scroll.
export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const provider = await getActiveProvider();

  const product = await prisma.product.findFirst({
    where: { id, providerId: provider.id },
    include: {
      prices: { include: { customer: { select: { id: true, firstName: true, lastName: true } }, segment: { select: { id: true, name: true } } } },
      accessRules: { include: { customer: { select: { id: true, firstName: true, lastName: true } }, segment: { select: { id: true, name: true } } } },
      bookingLinks: { include: { segment: { select: { id: true, name: true } } } },
    },
  });
  if (!product) notFound();

  const [segments, clients] = await Promise.all([
    prisma.customerSegment.findMany({ where: { providerId: provider.id }, orderBy: [{ isSystemDefault: "desc" }, { name: "asc" }] }),
    prisma.client.findMany({
      where: { providerId: provider.id },
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true, email: true },
      take: 500,
    }),
  ]);

  return (
    <main className="flex-1 px-6 py-10 max-w-3xl mx-auto pb-24">
      <p className="text-sm text-ink-700/50">
        <Link href="/admin/products" className="hover:underline">
          ← Produkte
        </Link>
      </p>
      <h1 className="mt-2 font-serif text-3xl font-bold text-ink-900">{product.name}</h1>

      <section className="mt-8">
        <h2 className="font-semibold text-lg text-ink-900">Grunddaten</h2>
        <div className="mt-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
          <ProductEditForm product={product as any} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-semibold text-lg text-ink-900">Sonderpreise</h2>
        <p className="text-xs text-ink-700/50">
          §26: Kunde-Override &gt; Segment-Override &gt; Standardpreis. Nie das Produkt duplizieren, stattdessen hier
          eine Ausnahme anlegen.
        </p>
        <div className="mt-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
          <PricesManager productId={product.id} prices={product.prices as any} segments={segments} clients={clients} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-semibold text-lg text-ink-900">Sichtbarkeit</h2>
        <p className="text-xs text-ink-700/50">
          §25: Für alle sichtbar, oder nur für ausgewählte Segmente/Kunden. Wechsle den Modus in den Grunddaten oben;
          hier verwaltest du die konkrete Freigabeliste.
        </p>
        <div className="mt-3">
          <AccessRulesManager
            productId={product.id}
            visibility={product.visibility}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts
            rules={product.accessRules as any}
            segments={segments}
            clients={clients}
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-semibold text-lg text-ink-900">Buchungslinks für dieses Produkt</h2>
        <p className="text-xs text-ink-700/50">
          §18/§19: Segment-Links (hier mit Produktbezug) haben Vorrang vor dem Standard-Link dieses Produkts. Alle
          Links inkl. produktübergreifender siehst du unter{" "}
          <Link href="/admin/booking-links" className="underline">
            Buchungslinks
          </Link>
          .
        </p>
        <div className="mt-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
          <ProductBookingLinksManager productId={product.id} links={product.bookingLinks as any} segments={segments} />
        </div>
      </section>
    </main>
  );
}
