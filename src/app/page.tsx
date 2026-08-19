import Script from "next/script";
import { getBranding } from "@/lib/branding";

// Real Calendly account connected to this provider (see
// mcp__Calendly__users-get_current_user at setup time) — replaces the old
// "Calendly booking widget goes here." placeholder box with an actual
// live embed. TODO (Phase 4, multi-tenant): once a second tenant exists,
// this needs to come from Provider/Service.calendlyEventTypeUri instead
// of being hardcoded to the Athletik Movement beta tenant's link.
const CALENDLY_SCHEDULING_URL = "https://calendly.com/athletikmovement";

// TODO (Phase 1 -> real data): replace with a Prisma query for the
// current Provider's services (`prisma.service.findMany({ where: { providerId }})`)
// — no Service rows are seeded yet, so this mirrors the real, current
// pricing from athletik-movement.de/preise until that's wired up.
const placeholderServices = [
  {
    id: "smartmotionscan",
    name: "SmartMotionScan",
    description: "3D-Haltungsanalyse: verstehen, warum dein Körper immer wieder in Schmerz, Spannung oder Fehlhaltung zurückfällt.",
    priceLabel: "499 €",
  },
  {
    id: "einzelsession",
    name: "Einzelsession",
    description: "Gezielte, direkte Arbeit an Schmerz, Haltung, Beweglichkeit und Kontrolle.",
    priceLabel: "Preis auf Anfrage",
  },
  {
    id: "movement-coaching",
    name: "Movement Coaching",
    description: "15er, 30er & 45er Pakete für strukturierte Veränderung über mehrere Monate.",
    priceLabel: "Preis auf Anfrage",
  },
];

export default function HomePage() {
  const branding = getBranding();

  return (
    <main className="flex-1">
      <section className="px-6 pt-20 pb-16 md:pt-28 md:pb-20">
        <div className="max-w-3xl mx-auto">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-brand-600">
            <span className="h-px w-6 bg-brand-500" aria-hidden />
            {branding.appName}
          </p>
          <h1 className="mt-5 font-serif text-4xl sm:text-5xl font-bold text-ink-900 leading-tight text-balance">
            {branding.tagline}
          </h1>
          <p className="mt-5 text-ink-700/80 max-w-xl text-lg">
            Buche direkt unten deinen nächsten Termin — oder wirf vorher einen Blick auf unsere
            Trainingspläne und die Übungsbibliothek.
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-14">
        <h2 className="font-serif text-2xl font-bold text-ink-900 mb-6">Termin buchen</h2>
        <div
          className="calendly-inline-widget rounded-xl overflow-hidden border border-ink-900/10 bg-white/40"
          data-url={CALENDLY_SCHEDULING_URL}
          style={{ minWidth: "320px", height: "700px" }}
        />
        <Script src="https://assets.calendly.com/assets/external/widget.js" strategy="lazyOnload" />
      </section>

      <section className="max-w-3xl mx-auto px-6 pb-24">
        <h2 className="font-serif text-2xl font-bold text-ink-900 mb-6">Sessions &amp; Pakete</h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {placeholderServices.map((service) => (
            <li
              key={service.id}
              className="rounded-xl border border-ink-900/10 bg-white/50 p-6"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-semibold text-ink-900">{service.name}</h3>
                <span className="text-ink-900 font-bold whitespace-nowrap">
                  {service.priceLabel}
                </span>
              </div>
              <p className="mt-2 text-sm text-ink-700/70">
                {service.description}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
