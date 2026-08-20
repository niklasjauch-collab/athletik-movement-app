/**
 * Calendly webhook handler — CoachAdmin briefing §20 CALENDLY
 * TERMINIMPORT / §21 UNMATCHED BOOKINGS.
 *
 * Handles `invitee.created` (a Calendly appointment was booked) and
 * `invitee.canceled` (booked appointment canceled). Matching (client by
 * invitee email, product/booking-link by event name, entitlement by §13's
 * reservation rules) lives in src/lib/calendlyMatching.ts — this route is
 * just: verify → parse → match → write Booking + reserve/release credit
 * via src/lib/creditLedger.ts.
 *
 * Signature verification: if CALENDLY_WEBHOOK_SIGNING_KEY is set, every
 * request is verified against Calendly's `Calendly-Webhook-Signature`
 * header (t=<unix ts>,v1=<hex hmac-sha256 of "t.rawBody">) before the
 * payload is trusted — webhook endpoints are public and unauthenticated
 * otherwise. Not configured in this environment (no Calendly webhook
 * subscription has been created yet — see the P4 status-doc entry for
 * what the user still needs to do in their Calendly account to make this
 * route receive real traffic); when unset, requests are accepted
 * unverified with a logged warning, same graceful-degradation pattern as
 * this app's other unconfigured integrations (e.g. RESEND_API_KEY).
 *
 * Always resolves 200 quickly, even on partial match failures —
 * "customer/product not found" is an expected, handled outcome (the
 * booking is still stored, unmatched, for /admin/appointments to
 * resolve), not an error. Calendly retries non-2xx responses, which we
 * don't want here since retries wouldn't change an honest non-match.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { matchClientByEmail, matchProductByEventName, pickEntitlementForBooking } from "@/lib/calendlyMatching";
import { reserveCreditForBooking, releaseReservedCredit } from "@/lib/creditLedger";

function verifySignature(rawBody: string, header: string | null, signingKey: string): boolean {
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

  const expected = createHmac("sha256", signingKey).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
  if (signingKey) {
    const ok = verifySignature(rawBody, request.headers.get("Calendly-Webhook-Signature"), signingKey);
    if (!ok) {
      console.warn("[calendly webhook] signature verification failed — rejecting");
      return Response.json({ error: "invalid signature" }, { status: 401 });
    }
  } else {
    console.warn("[calendly webhook] CALENDLY_WEBHOOK_SIGNING_KEY not configured — accepting unverified");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- webhook payload, not a typed model
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const eventType = payload?.event as string | undefined;
  const p = payload?.payload ?? {};
  const scheduledEvent = p.scheduled_event ?? {};

  try {
    switch (eventType) {
      case "invitee.created": {
        const eventUri: string | undefined = scheduledEvent.uri ?? p.event;
        const startTimeRaw: string | undefined = scheduledEvent.start_time;
        if (!eventUri || !startTimeRaw) {
          console.error("[calendly webhook] invitee.created missing event uri/start_time — dropping", {
            eventUri,
            startTimeRaw,
          });
          break;
        }

        // Idempotent: Calendly delivers webhooks at-least-once — a resend
        // of an already-stored event must not reserve a second credit.
        const existing = await prisma.booking.findUnique({ where: { calendlyEventUri: eventUri } });
        if (existing) {
          console.log("[calendly webhook] invitee.created — already stored, skipping", eventUri);
          break;
        }

        const provider = await getActiveProvider();
        const client = await matchClientByEmail(provider.id, p.email);
        const { product, bookingLink } = await matchProductByEventName(provider.id, scheduledEvent.name);
        const entitlement = client ? await pickEntitlementForBooking(client.id, product) : null;

        const booking = await prisma.booking.create({
          data: {
            clientId: client?.id ?? null,
            calendlyEventUri: eventUri,
            calendlyInviteeUri: p.uri ?? null,
            inviteeName: p.name ?? null,
            inviteeEmail: p.email ?? null,
            calendlyEventName: scheduledEvent.name ?? null,
            status: "CONFIRMED",
            startTime: new Date(startTimeRaw),
            endTime: scheduledEvent.end_time ? new Date(scheduledEvent.end_time) : null,
            cancelUrl: p.cancel_url ?? null,
            rescheduleUrl: p.reschedule_url ?? null,
            bookingLinkId: bookingLink?.id ?? null,
            productId: product?.id ?? null,
            entitlementId: entitlement?.id ?? null,
          },
        });

        if (entitlement) {
          await reserveCreditForBooking(booking.id, entitlement.id);
        }

        console.log(
          `[calendly webhook] invitee.created — booking ${booking.id} (client: ${client?.id ?? "unmatched"}, product: ${product?.id ?? "unmatched"}, entitlement: ${entitlement?.id ?? "none"})`,
        );
        break;
      }

      case "invitee.canceled": {
        const eventUri: string | undefined = scheduledEvent.uri ?? p.event;
        const inviteeUri: string | undefined = p.uri;
        const booking = eventUri
          ? await prisma.booking.findUnique({ where: { calendlyEventUri: eventUri } })
          : inviteeUri
            ? await prisma.booking.findUnique({ where: { calendlyInviteeUri: inviteeUri } })
            : null;

        if (!booking) {
          console.warn("[calendly webhook] invitee.canceled — no matching booking found, nothing to release", eventUri);
          break;
        }
        if (booking.status !== "CONFIRMED") {
          console.log(`[calendly webhook] invitee.canceled — booking ${booking.id} already ${booking.status}, skipping`);
          break;
        }

        await prisma.booking.update({ where: { id: booking.id }, data: { status: "CANCELED" } });
        if (booking.entitlementId) {
          await releaseReservedCredit(booking.id, booking.entitlementId);
        }
        console.log(`[calendly webhook] invitee.canceled — booking ${booking.id} canceled, credit released`);
        break;
      }

      default:
        console.log("[calendly webhook] unhandled event", eventType);
    }
  } catch (err) {
    // Log and still 200 — a webhook processing bug shouldn't turn into a
    // Calendly retry storm; the raw payload is in the log for replay.
    console.error("[calendly webhook] processing error", err, JSON.stringify(payload));
  }

  return Response.json({ received: true });
}
