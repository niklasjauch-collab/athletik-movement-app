import Link from "next/link";
import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import BookingLinksManager from "./BookingLinksManager";

export const dynamic = "force-dynamic";

// CoachAdmin briefing §18 CALENDLY LINK MANAGER — every booking link in
// one place, regardless of scope (standard/segment/product). Creating a
// product-scoped link from a product's own detail page is also possible
// (a shortcut into the same table) — this page is the complete overview.
export default async function BookingLinksPage() {
  const provider = await getActiveProvider();
  const [links, products, segments] = await Promise.all([
    prisma.bookingLink.findMany({
      where: { providerId: provider.id },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { product: { select: { id: true, name: true } }, segment: { select: { id: true, name: true } } },
    }),
    prisma.product.findMany({ where: { providerId: provider.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.customerSegment.findMany({ where: { providerId: provider.id }, orderBy: [{ isSystemDefault: "desc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);

  return (
    <main className="flex-1 px-6 py-10 max-w-4xl mx-auto">
      <p className="text-sm text-ink-700/50">
        <Link href="/admin/products" className="hover:underline">
          ← Produkte
        </Link>
      </p>
      <h1 className="mt-2 font-serif text-3xl font-bold text-ink-900">Buchungslinks</h1>
      <p className="mt-1 text-sm text-ink-700/70">
        §19 Auflösung: individueller Kunden-Link (Zugang verwalten auf der Kundenseite) &gt; Segment-Link &gt;
        Produkt-Link &gt; Standard-Link ohne Produkt-/Segmentbezug. Der Kunde wählt nie selbst — die App löst das
        automatisch auf.
      </p>

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
      <BookingLinksManager links={links as any} products={products} segments={segments} />
    </main>
  );
}
