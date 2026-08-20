/**
 * Calendly webhook handler.
 *
 * Handles `invitee.created` and `invitee.canceled` events (see concept
 * doc, section 4). This is a scaffold — still P4 (CoachAdmin briefing
 * §20-§23 Calendly-Termin-Sync) work, not built yet:
 *  - Currently: just log/acknowledge, no Booking/credits logic.
 *  - P4: match payload.payload to a Client + Product (via
 *    src/lib/commerceResolution.ts, same as the customer app), create a
 *    real Booking row, resolve which PackageEntitlement it draws from,
 *    and call src/lib/creditLedger.ts's reserveCreditForBooking() /
 *    releaseReservedCredit() / completeCreditForBooking() (§13 — the
 *    ledger engine already exists as of P3, this handler just needs to
 *    call into it; do NOT reintroduce a CreditBalance-style mutable
 *    counter). Unmatched bookings (§21) need their own handling too.
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
      // TODO(P4): match payload.payload to a Client + Product, create a
      // Booking, and (if the Product is a COACHING_PACKAGE) call
      // src/lib/creditLedger.ts's reserveCreditForBooking().
      console.log("[calendly webhook] invitee.created", payload?.payload?.uri);
      break;
    case "invitee.canceled":
      // TODO(P4): mark the Booking as CANCELED, then call
      // releaseReservedCredit() if on-time (§13) or, per
      // Product.consumeCreditOnLateCancel, completeCreditForBooking()
      // if within Product.lateCancelHours of the appointment.
      console.log("[calendly webhook] invitee.canceled", payload?.payload?.uri);
      break;
    default:
      console.log("[calendly webhook] unhandled event", eventType);
  }

  return Response.json({ received: true });
}
