/**
 * Calendly webhook handler.
 *
 * Handles `invitee.created` and `invitee.canceled` events (see concept
 * doc, section 4). This is a Phase 1/2 scaffold:
 *  - Phase 1: just log/acknowledge, no credits logic yet.
 *  - Phase 2: look up the booked event type, decide whether it's a
 *    single-session purchase (Calendly/Stripe already handled payment)
 *    or a package redemption, then decrement/refund the CreditBalance
 *    in the database and fire the low-balance notification when it
 *    hits zero.
 *
 * TODO before going live:
 *  - Verify the webhook signature using CALENDLY_WEBHOOK_SIGNING_KEY
 *    (Calendly signs payloads with HMAC-SHA256, see their webhook docs).
 *  - Replace the console.log calls with actual Prisma writes once the
 *    database is connected.
 */

export async function POST(request: Request) {
  const payload = await request.json();

  const eventType = payload?.event as string | undefined;

  switch (eventType) {
    case "invitee.created":
      // TODO: match payload.payload to a Client + Service, create a Booking,
      // and if the Service is a PACKAGE, decrement the matching CreditBalance.
      console.log("[calendly webhook] invitee.created", payload?.payload?.uri);
      break;
    case "invitee.canceled":
      // TODO: mark the Booking as CANCELED and refund the credit if within
      // the cancellation window.
      console.log("[calendly webhook] invitee.canceled", payload?.payload?.uri);
      break;
    default:
      console.log("[calendly webhook] unhandled event", eventType);
  }

  return Response.json({ received: true });
}
