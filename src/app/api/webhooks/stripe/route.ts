/**
 * Stripe webhook handler — CoachAdmin briefing §28-§31 Zahlungen/Stripe.
 *
 * Handles `checkout.session.completed`: a package/session purchase made
 * through a (not-yet-built) Stripe Checkout flow. Mirrors the shape of
 * src/app/api/webhooks/calendly/route.ts — verify → parse → idempotent
 * write — rather than the raw-payload console.log stub this route used to
 * be before P7 (Runde 5 Teil 9).
 *
 * Signature verification: Stripe signs with `Stripe-Signature: t=<unix
 * ts>,v1=<hex hmac-sha256 of "<t>.<rawBody>">`, the same construction
 * Calendly uses (verified against Stripe's public webhook docs, not
 * assumed) — verified here by hand with node:crypto rather than the
 * `stripe` npm package, since that package isn't installed and pulling it
 * in just for signature checking would be one more dependency for a route
 * that can't be live-tested in this environment anyway (no
 * STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET configured — see the P7
 * status-doc entry). When STRIPE_WEBHOOK_SECRET is unset, requests are
 * accepted unverified with a logged warning — same graceful-degradation
 * pattern as the Calendly/RESEND integrations.
 *
 * Checkout Session → Payment mapping: this route expects
 * `session.metadata.clientId` and `session.metadata.productId` to be set
 * by whatever creates the Checkout Session (not built yet — P7 only
 * covers the webhook side and the manual-payment path; a real "Kunde
 * kauft im Shop" checkout-creation flow is future work once Stripe keys
 * exist). `session.payment_intent` (or `session.id` as a fallback) is the
 * Payment's idempotency key — a resent webhook must not create a second
 * Payment/Entitlement, same discipline as Calendly's
 * `calendlyEventUri`-based idempotency.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { createManualEntitlement } from "@/lib/creditLedger";

function verifySignature(rawBody: string, header: string | null, signingSecret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const [k, v] = kv.split("=");
      return [k?.trim(), v?.trim()];
    }),
  );
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;

  const expected = createHmac("sha256", signingSecret).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  const signingSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (signingSecret) {
    const ok = verifySignature(rawBody, request.headers.get("Stripe-Signature"), signingSecret);
    if (!ok) {
      console.warn("[stripe webhook] signature verification failed — rejecting");
      return Response.json({ error: "invalid signature" }, { status: 401 });
    }
  } else {
    console.warn("[stripe webhook] STRIPE_WEBHOOK_SECRET not configured — accepting unverified");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- webhook payload, not a typed model
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const eventType = payload?.type as string | undefined;

  try {
    switch (eventType) {
      case "checkout.session.completed": {
        const session = payload?.data?.object ?? {};
        const stripePaymentId: string | undefined = session.payment_intent ?? session.id;
        const clientId: string | undefined = session.metadata?.clientId;
        const productId: string | undefined = session.metadata?.productId;
        const amountCents: number = typeof session.amount_total === "number" ? session.amount_total : 0;

        if (!stripePaymentId || !clientId) {
          console.error("[stripe webhook] checkout.session.completed missing payment id / clientId metadata — dropping", {
            stripePaymentId,
            clientId,
          });
          break;
        }

        // Idempotent: Stripe delivers webhooks at-least-once.
        const existing = await prisma.payment.findUnique({ where: { stripePaymentId } });
        if (existing) {
          console.log("[stripe webhook] checkout.session.completed — already recorded, skipping", stripePaymentId);
          break;
        }

        const client = await prisma.client.findUnique({ where: { id: clientId } });
        if (!client) {
          console.error("[stripe webhook] checkout.session.completed — unknown clientId, dropping", clientId);
          break;
        }

        const product = productId ? await prisma.product.findUnique({ where: { id: productId } }) : null;

        const entitlement =
          product && product.type === "COACHING_PACKAGE" && product.credits
            ? await createManualEntitlement({
                clientId: client.id,
                productId: product.id,
                label: product.name,
                totalCredits: product.credits,
                expiresAt: product.validityDays ? new Date(Date.now() + product.validityDays * 86_400_000) : null,
                note: "Stripe Checkout",
                adminId: null, // webhook, not an admin session — see creditLedger.ts's doc comment
                source: "stripe_checkout",
              }).catch((err) => {
                console.error("[stripe webhook] entitlement creation failed", err);
                return null;
              })
            : null;

        await prisma.payment.create({
          data: {
            providerId: client.providerId,
            clientId: client.id,
            productId: product?.id ?? null,
            entitlementId: entitlement?.id ?? null,
            listPriceCents: product?.priceCents ?? amountCents,
            discountCents: product ? Math.max(0, product.priceCents - amountCents) : 0,
            amountCents,
            method: "STRIPE",
            status: "PAID",
            stripePaymentId,
          },
        });

        console.log(`[stripe webhook] checkout.session.completed — payment recorded for client ${client.id}`);
        break;
      }
      default:
        console.log("[stripe webhook] unhandled event", eventType);
    }
  } catch (err) {
    // Log and still 200 — same reasoning as the Calendly webhook: a
    // processing bug shouldn't turn into a Stripe retry storm, and the
    // raw payload is in the log for manual replay.
    console.error("[stripe webhook] processing error", err, JSON.stringify(payload));
  }

  return Response.json({ received: true });
}
