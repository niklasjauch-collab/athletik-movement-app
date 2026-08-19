import { getBranding } from "@/lib/branding";

// TODO (Phase 1 -> real data): replace with a Prisma query for the
// current Provider's services (`prisma.service.findMany({ where: { providerId }})`).
const placeholderServices = [
  {
    id: "single-session",
    name: "Single Session",
    description: "One 60-minute training or therapy session.",
    priceLabel: "€75",
  },
  {
    id: "package-10",
    name: "10-Session Package",
    description: "Ten sessions, book them whenever you like via your personal link.",
    priceLabel: "€650",
  },
];

export default function HomePage() {
  const branding = getBranding();

  return (
    <main className="flex-1">
      <section className="bg-slate-900 text-white px-6 py-20 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight">
          {branding.appName}
        </h1>
        <p className="mt-4 text-slate-300 max-w-xl mx-auto text-lg">
          {branding.tagline}
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold mb-6">Book a session</h2>

        {/*
          TODO (Phase 1): replace this placeholder with the real Calendly
          inline embed widget for the provider's event type, e.g.:

          <div
            className="calendly-inline-widget"
            data-url="https://calendly.com/<org>/<event-type>"
            style={{ minWidth: "320px", height: "700px" }}
          />
          <Script src="https://assets.calendly.com/assets/external/widget.js" />

          See: https://developer.calendly.com/embed-options
        */}
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
          Calendly booking widget goes here.
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-bold mb-6">Sessions &amp; packages</h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {placeholderServices.map((service) => (
            <li
              key={service.id}
              className="rounded-xl border border-slate-200 p-6"
            >
              <div className="flex items-baseline justify-between">
                <h3 className="font-semibold">{service.name}</h3>
                <span className="text-slate-900 font-bold">
                  {service.priceLabel}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {service.description}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
