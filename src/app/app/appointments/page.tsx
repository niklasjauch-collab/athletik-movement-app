import { getCurrentClient } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BOOKING_OFFERS } from "@/lib/bookingOffers";

// Hits the database directly without calling cookies()/headers() itself
// in its render path — same force-dynamic note as /clients, /shop, etc.
export const dynamic = "force-dynamic";

// Termine: upcoming/past appointments (synced from Calendly via
// /api/webhooks/calendly — see that route's TODOs; the Booking table
// exists and is queried for real here, it's just empty until the
// webhook is wired up to actually write to it, P5) plus the ONLY five
// bookable offers (spec section 18 — deliberately a fixed list, not
// derived from the full Calendly event-type catalog).
export default async function AppointmentsPage() {
  const client = await getCurrentClient();
  if (!client) return null; // AppLayout already redirects; satisfies TS

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
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {BOOKING_OFFERS.map((offer) => (
            <li key={offer.id} className="rounded-xl border border-ink-900/10 bg-white/50 p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-semibold text-ink-900">{offer.title}</h3>
                <span className="font-bold text-ink-900 whitespace-nowrap">{offer.priceLabel}</span>
              </div>
              <a
                href={offer.calendlyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 block w-full rounded-lg bg-brand-600 text-white text-center py-2 text-sm font-semibold hover:bg-brand-700"
              >
                {offer.ctaLabel.toUpperCase()}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
