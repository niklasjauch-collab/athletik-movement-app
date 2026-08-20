// CoachAdmin briefing §20-§21 — turning a Calendly webhook payload into a
// matched (or honestly unmatched) Booking. Kept separate from the webhook
// route itself so the matching heuristics are readable/reviewable on
// their own, and so /api/admin/appointments/[id]/action can reuse the
// same entitlement-picking logic when an admin manually (re-)matches a
// booking.
//
// SANDBOX-ONLY, see the top of src/lib/db.ts for why: this file imports
// types from @prisma/client, which isn't generated in this environment.
// Remove the two lines below once `npx prisma generate` can run
// somewhere with normal internet access.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { prisma } from "./db";
import { computeStatus } from "./creditLedger";

/** §21 — invitee email is the only reliable identifier a Calendly webhook
 * gives us for free (no Calendly API token is configured in this
 * environment to look up more). Case-insensitive, scoped to the provider
 * (Client.email is only unique per provider, see Client's own comment). */
export async function matchClientByEmail(providerId: string, email: string | null | undefined) {
  const trimmed = (email ?? "").trim();
  if (!trimmed) return null;
  return prisma.client.findFirst({
    where: { providerId, email: { equals: trimmed, mode: "insensitive" } },
  });
}

/** §20/§56 — resolves which commercial Product (and, best-effort, which
 * BookingLink) a Calendly event corresponds to, using ONLY the event's
 * display name from the webhook payload (`scheduled_event.name`) — no
 * Calendly API call, since no CALENDLY_API_TOKEN is configured here to
 * resolve the event_type URI the payload actually carries into a
 * scheduling_url we could compare against BookingLink.url directly. This
 * is a deliberate, documented simplification: matching by name is not as
 * precise as matching by scheduling_url would be, but requires zero extra
 * infrastructure and works for the real event types already on the
 * connected Calendly account (verified against the live account during
 * this round — "SmartMotionScan", "Movement Coaching ", "Movement
 * Coaching GetImpulse" all either exact- or substring-match a seeded
 * Product/BookingLink name). Only SMARTMOTION_SCAN/COACHING_SESSION
 * products are candidates — COACHING_PACKAGE products are never
 * themselves "booked" as a Calendly event, they're a credit source (see
 * pickEntitlementForBooking below), and DIGITAL_TRAINING_PLAN isn't
 * booked via Calendly at all. */
export async function matchProductByEventName(providerId: string, eventName: string | null | undefined) {
  const name = (eventName ?? "").trim().toLowerCase();
  if (!name) return { product: null, bookingLink: null };

  const candidates = await prisma.product.findMany({
    where: { providerId, active: true, type: { in: ["SMARTMOTION_SCAN", "COACHING_SESSION"] } },
  });
  for (const p of candidates) {
    const pname = p.name.toLowerCase();
    if (pname === name || pname.includes(name) || name.includes(pname)) {
      return { product: p, bookingLink: null };
    }
  }

  // Fallback: match against BookingLink names too (covers e.g. "Movement
  // Coaching GetImpulse", whose BookingLink is segment-scoped with no
  // productId of its own).
  const links = await prisma.bookingLink.findMany({
    where: { providerId, active: true },
    include: { product: true },
  });
  for (const l of links) {
    const lname = l.name.toLowerCase();
    if (lname === name || lname.includes(name) || name.includes(lname)) {
      return { product: l.product ?? null, bookingLink: l };
    }
  }

  // Last-resort generic fallback: any event whose name mentions
  // "coaching" is treated as a standard coaching session for credit
  // purposes, even if no exact product/link name matched (real accounts
  // accumulate one-off/renamed event types over time — see e.g.
  // "Business Health Coaching" on the connected account, which sells a
  // different way but is still fundamentally a coaching appointment).
  if (name.includes("coaching")) {
    const fallback = await prisma.product.findFirst({
      where: { providerId, type: "COACHING_SESSION", active: true },
    });
    if (fallback) return { product: fallback, bookingLink: null };
  }

  return { product: null, bookingLink: null };
}

/** §13/§16 — which of a client's active entitlements should this booking
 * reserve a credit from. Only meaningful for session-consuming product
 * types; SmartMotionScan/digital plans have no credit concept here.
 * Searches ALL of the client's coaching-type entitlements, not just ones
 * tied to the exact matched Product row — a booking against the shared
 * "Movement Coaching" Calendly link can draw from a 15er, 30er, 45er, or
 * a Freund's generic unlimited grant alike (§67 "Kunde mit zwei
 * Paketen"). Sorts soonest-expiring-first, then oldest-first (FIFO),
 * with unlimited entitlements sorted last — spend a real, dwindling
 * package before quietly falling back on a Freund's unlimited grant. */
export async function pickEntitlementForBooking(clientId: string, product: { type: string } | null) {
  if (!product || (product.type !== "COACHING_SESSION" && product.type !== "COACHING_PACKAGE")) return null;

  const entitlements = await prisma.packageEntitlement.findMany({
    where: { clientId, active: true },
    include: { product: true, ledgerEntries: true },
  });

  const eligible = entitlements
    .filter((e) => !e.product || e.product.type === "COACHING_SESSION" || e.product.type === "COACHING_PACKAGE")
    .map((e) => ({ ...e, status: computeStatus(e, e.ledgerEntries) }))
    .filter((e) => e.unlimited || e.status.available > 0);

  eligible.sort((a, b) => {
    if (a.unlimited !== b.unlimited) return a.unlimited ? 1 : -1;
    const aExp = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity;
    const bExp = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity;
    if (aExp !== bExp) return aExp - bExp;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return eligible[0] ?? null;
}
