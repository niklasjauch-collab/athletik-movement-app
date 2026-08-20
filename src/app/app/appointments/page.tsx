import { getCurrentClient } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { resolveProductPrice, resolveBookingLink, isProductVisibleTo } from "@/lib/commerceResolution";

// Hits the database directly without calling cookies()/headers() itself
// in its render path — same force-dynamic note as /clients, /shop, etc.
export const dynamic = "force-dynamic";

// Termine: upcoming/past appointments (synced from Calendly via
// /api/webhooks/calendly — see that route's TODOs; the Booking table
// exists and is queried for real here, it's just empty until the
// webhook is wired up to actually write to it, P5) plus the bookable
// products. Runde 5 Teil 4/P2: this used to render a hardcoded
// BOOKING_OFFERS list (src/lib/bookingOffers.ts) — now it reads real
// Product rows and resolves price/booking-link per §19/§26 via
// src/lib/commerceResolution.ts, per §66's explicit constraint that the
// customer app must derive its view from admin data, never duplicate it.
export default async function AppointmentsPage() {
  const client = await getCurrentClient();
  if (!client) return null; // AppLayout already redirects; satisfies TS

  const provider = await getActiveProvider();
  const allProducts = await prisma.product.findMany({
    where: { providerId: provider.id, type: { not: "DIGITAL_TRAINING_PLAN" } }, // this page is for bookable offerings; digital plans belong in the shop, not here
    orderBy: { createdAt: "asc" },
  });
  const visibleProducts = [];
  for (const product of allProducts) {
    if (await isProductVisibleTo(product, client)) visibleProducts.push(product);
  }
  const offers = await Promise.all(
    visibleProducts.map(async (product) => {
      const price = await resolveProductPrice(product, client);
      const link = await resolveBookingLink(product, client);
      return { product, price, link };
    }),
  );

  const [upcoming, past] = await Promise.all([
    prisma.booking.findMany({
      where: { clientId: client.id, status: "CONFIRMED", startTime: { gte: new Date() } },
      orderBy: { startTime: "asc" },
    }),
    prisma.booking.findMany({
      where: {
        clientId: client.id,
        OR: [{ status: { not: "CONFIRMED" } }, { startTime: { lt: new Date() } }],
      },
      orderBy: { startTime: "desc" },
      take: 20,
    }),
  ]);

  return (
    <main className="flex-1 max-w-3xl mx-auto px-6 py-16 pb-28">
      <h1 className="font-serif text-3xl font-bold text-ink-900">Termine</h1>

      <section className="mt-8">
        <h2 className="font-serif text-lg font-bold text-ink-900">Kommende Termine</h2>
        {upcoming.length === 0 ? (
          <p className="mt-3 text-sm text-ink-700/60">Kein anstehender Termin gebucht.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
            {upcoming.map((b: any) => (
              <li key={b.id} className="rounded-xl border border-ink-900/10 bg-white/50 p-4">
                <p className="font-medium text-ink-900">
                  {b.startTime.toLocaleString("de-DE", {
                    weekday: "short",
                    day: "2-digit",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  Uhr
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-lg font-bold text-ink-900">Vergangene Termine</h2>
        {past.length === 0 ? (
          <p className="mt-3 text-sm text-ink-700/60">Noch keine vergangenen Termine.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
            {past.map((b: any) => (
              <li key={b.id} className="rounded-xl border border-ink-900/10 p-4 text-sm text-ink-700/70">
                {b.startTime.toLocaleDateString("de-DE")} · {b.status}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-lg font-bold text-ink-900">Neuen Termin buchen</h2>
        <p className="mt-2 text-sm text-ink-700/70">
          Buchung läuft über Calendly — nach der Buchung erscheint dein Termin automatisch oben.
        </p>
        {offers.length === 0 ? (
          <p className="mt-4 text-sm text-ink-700/60">Aktuell keine buchbaren Angebote hinterlegt.</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {offers.map(({ product, price, link }) => (
              <li key={product.id} className="rounded-xl border border-ink-900/10 bg-white/50 p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-semibold text-ink-900">{product.name}</h3>
                  <span className="font-bold text-ink-900 whitespace-nowrap">
                    {(price.priceCents / 100).toLocaleString("de-DE", { style: "currency", currency: price.currency })}
                  </span>
                </div>
                {link ? (
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 block w-full rounded-lg bg-brand-600 text-white text-center py-2 text-sm font-semibold hover:bg-brand-700"
                  >
                    {product.name.toUpperCase()} BUCHEN
                  </a>
                ) : (
                  <p className="mt-4 text-xs text-ink-700/50">Noch nicht buchbar — bitte direkt beim Coach melden.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
