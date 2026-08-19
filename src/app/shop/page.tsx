import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { getBranding } from "@/lib/branding";

// Hits the database directly and doesn't itself call cookies()/headers(),
// so Next's automatic dynamic-API detection won't defer it — without this,
// `next build` tries to prerender it statically, which fails hard if the
// database isn't reachable from the build environment. Same issue/fix as
// /clients/page.tsx.
export const dynamic = "force-dynamic";

// Real DigitalProduct catalog (was a single hardcoded placeholder product
// before). No purchase flow is wired up yet — see the disabled button
// below — so this intentionally shows real (possibly empty) data rather
// than fake content, and is honest that checkout isn't live yet rather
// than having a button that silently does nothing.
export default async function ShopPage() {
  const branding = getBranding();
  const provider = await getActiveProvider();
  const products = await prisma.digitalProduct.findMany({
    where: { providerId: provider.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="flex-1 max-w-3xl mx-auto px-6 py-16">
      <h1 className="font-serif text-3xl font-bold text-ink-900">Trainingspläne</h1>
      <p className="mt-2 text-ink-700/80">
        Fertige Trainingspläne von {branding.appName}, direkt nach dem Kauf verfügbar.
      </p>

      {products.length === 0 ? (
        <p className="mt-10 text-sm text-ink-700/60">
          Aktuell sind noch keine Trainingspläne im Shop hinterlegt.
        </p>
      ) : (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {/* `: any` is SANDBOX-ONLY, see src/lib/db.ts */}
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
          {products.map((product: any) => (
            <li key={product.id} className="rounded-xl border border-ink-900/10 bg-white/50 p-6">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-semibold text-ink-900">{product.title}</h2>
                <span className="text-ink-900 font-bold whitespace-nowrap">
                  {(product.priceCents / 100).toFixed(2).replace(".", ",")} €
                </span>
              </div>
              {product.description && (
                <p className="mt-2 text-sm text-ink-700/70">{product.description}</p>
              )}
              {/*
                TODO (Phase 1): wire this button to a Stripe Checkout session
                created via a server action / route handler that sets
                metadata: { type: "digital_product", productId: product.id }
                so the webhook (src/app/api/webhooks/stripe/route.ts) knows
                what to unlock on payment. Disabled for now rather than a
                button that looks live but silently does nothing.
              */}
              <button
                type="button"
                disabled
                title="Online-Kauf folgt in Kürze"
                className="mt-4 w-full rounded-lg bg-ink-900/10 text-ink-700/50 py-2 text-sm font-semibold cursor-not-allowed"
              >
                Kauf folgt in Kürze
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
