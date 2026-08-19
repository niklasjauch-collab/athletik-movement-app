/**
 * Stripe webhook handler.
 *
 * Handles `checkout.session.completed` (see concept doc, section 4):
 * a package top-up or a digital product purchase. This is a Phase 1/2
 * scaffold — no Stripe SDK call yet, just the shape of the handler.
 *
 * TODO before going live:
 *  - Verify the webhook signature with `stripe.webhooks.constructEvent`
 *    using STRIPE_WEBHOOK_SECRET (do this BEFORE trusting the payload —
 *    Stripe webhook endpoints are public and unauthenticated otherwise).
 *  - On checkout.session.completed:
 *      - if metadata.type === "package": create/top-up a CreditBalance
 *      - if metadata.type === "digital_product": create an Order and
 *        unlock the product in the client portal (Phase 3)
 */

export async function POST(request: Request) {
  // NOTE: Stripe requires the *raw* request body for signature
  // verification — don't call request.json() before verifying in the
  // real implementation. This stub reads it directly for now.
  const payload = await request.json();

  const eventType = payload?.type as string | undefined;

  switch (eventType) {
    case "checkout.session.completed":
      // TODO: read payload.data.object.metadata to decide package vs.
      // digital product, then write to the database via Prisma.
      console.log(
        "[stripe webhook] checkout.session.completed",
        payload?.data?.object?.id
      );
      break;
    default:
      console.log("[stripe webhook] unhandled event", eventType);
  }

  return Response.json({ received: true });
}
