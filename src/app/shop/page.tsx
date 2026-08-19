import { getBranding } from "@/lib/branding";

// TODO (Phase 1 -> real data): replace with a Prisma query for the
// current Provider's digital products
// (`prisma.digitalProduct.findMany({ where: { providerId }})`).
const placeholderProducts = [
  {
    id: "back-program",
    title: "8-Week Back Program",
    description:
      "A structured mobility and strength program for lower back health.",
    priceLabel: "€39",
  },
];

export default function ShopPage() {
  const branding = getBranding();

  return (
    <main className="flex-1 max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-extrabold">Training plans</h1>
      <p className="mt-2 text-slate-500">
        Ready-made training plans from {branding.appName}, delivered instantly
        after purchase.
      </p>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {placeholderProducts.map((product) => (
          <li key={product.id} className="rounded-xl border border-slate-200 p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">{product.title}</h2>
              <span className="text-slate-900 font-bold">
                {product.priceLabel}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-500">{product.description}</p>
            {/*
              TODO (Phase 1): wire this button to a Stripe Checkout session
              created via a server action / route handler that sets
              metadata: { type: "digital_product", productId: product.id }
              so the webhook (src/app/api/webhooks/stripe/route.ts) knows
              what to unlock on payment.
            */}
            <button
              type="button"
              className="mt-4 w-full rounded-lg bg-slate-900 text-white py-2 text-sm font-semibold"
            >
              Buy now
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
