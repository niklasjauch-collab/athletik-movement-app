// CoachAdmin briefing §21 UNMATCHED BOOKINGS + §23 TERMINDETAILS — the one
// action endpoint behind every button on /admin/appointments/[id],
// discriminated by `action` (same "bundle related mutations behind one
// route" pattern as the entitlement-adjust route from P3).
import { prisma } from "@/lib/db";
import { requireAdmin, AdminAuthRequiredError } from "@/lib/adminAuth";
import { pickEntitlementForBooking } from "@/lib/calendlyMatching";
import { reserveCreditForBooking, releaseReservedCredit, completeCreditForBooking } from "@/lib/creditLedger";

const ACTIONS = [
  "COMPLETE",
  "NO_SHOW",
  "SKIP_CREDIT",
  "MATCH_CLIENT",
  "MATCH_PRODUCT",
  "REASSIGN_ENTITLEMENT",
  "MARK_COMPLIMENTARY",
] as const;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AdminAuthRequiredError) {
      return Response.json({ error: "Nicht als Coach angemeldet." }, { status: 401 });
    }
    throw err;
  }

  const { id } = await params;
  const booking = await prisma.booking.findUnique({ where: { id }, include: { product: true } });
  if (!booking) {
    return Response.json({ error: "Termin nicht gefunden." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  const { action, clientId, productId, entitlementId } = (body ?? {}) as Record<string, unknown>;
  if (typeof action !== "string" || !ACTIONS.includes(action as (typeof ACTIONS)[number])) {
    return Response.json({ error: "Unbekannte Aktion." }, { status: 400 });
  }

  switch (action) {
    case "COMPLETE": {
      if (booking.entitlementId) {
        await completeCreditForBooking(booking.id, booking.entitlementId);
      }
      await prisma.booking.update({ where: { id: booking.id }, data: { status: "COMPLETED" } });
      break;
    }

    case "NO_SHOW": {
      // §13 — per-product rule, built in P3's schema, wired up for real
      // here for the first time: consume the credit by default (Product.
      // consumeCreditOnNoShow), or release it if the coach configured
      // this product to be lenient about no-shows.
      if (booking.entitlementId) {
        const consumeOnNoShow = booking.product?.consumeCreditOnNoShow ?? true;
        if (consumeOnNoShow) {
          await completeCreditForBooking(booking.id, booking.entitlementId);
        } else {
          await releaseReservedCredit(booking.id, booking.entitlementId);
        }
      }
      await prisma.booking.update({ where: { id: booking.id }, data: { status: "NO_SHOW" } });
      break;
    }

    case "SKIP_CREDIT": {
      if (booking.entitlementId) {
        await releaseReservedCredit(booking.id, booking.entitlementId);
      }
      await prisma.booking.update({
        where: { id: booking.id },
        data: { entitlementId: null, complimentary: true },
      });
      break;
    }

    case "MARK_COMPLIMENTARY": {
      // §21 "als kostenlose Session markieren" — resolves an unmatched
      // booking without requiring a client/product match at all.
      if (booking.entitlementId) {
        await releaseReservedCredit(booking.id, booking.entitlementId);
      }
      await prisma.booking.update({
        where: { id: booking.id },
        data: { entitlementId: null, complimentary: true },
      });
      break;
    }

    case "MATCH_CLIENT": {
      if (typeof clientId !== "string" || !clientId) {
        return Response.json({ error: "Kunde fehlt." }, { status: 400 });
      }
      const client = await prisma.client.findUnique({ where: { id: clientId } });
      if (!client) return Response.json({ error: "Kunde nicht gefunden." }, { status: 404 });

      let newEntitlementId = booking.entitlementId;
      if (!newEntitlementId && booking.productId) {
        const entitlement = await pickEntitlementForBooking(clientId, booking.product);
        if (entitlement) {
          await reserveCreditForBooking(booking.id, entitlement.id);
          newEntitlementId = entitlement.id;
        }
      }
      await prisma.booking.update({
        where: { id: booking.id },
        data: { clientId, entitlementId: newEntitlementId },
      });
      break;
    }

    case "MATCH_PRODUCT": {
      const nextProductId = typeof productId === "string" && productId ? productId : null;
      const product = nextProductId ? await prisma.product.findUnique({ where: { id: nextProductId } }) : null;
      if (nextProductId && !product) return Response.json({ error: "Produkt nicht gefunden." }, { status: 404 });

      let newEntitlementId = booking.entitlementId;
      if (!newEntitlementId && booking.clientId && product) {
        const entitlement = await pickEntitlementForBooking(booking.clientId, product);
        if (entitlement) {
          await reserveCreditForBooking(booking.id, entitlement.id);
          newEntitlementId = entitlement.id;
        }
      }
      await prisma.booking.update({
        where: { id: booking.id },
        data: { productId: nextProductId, entitlementId: newEntitlementId },
      });
      break;
    }

    case "REASSIGN_ENTITLEMENT": {
      const nextEntitlementId = typeof entitlementId === "string" && entitlementId ? entitlementId : null;
      if (nextEntitlementId) {
        const entitlement = await prisma.packageEntitlement.findUnique({ where: { id: nextEntitlementId } });
        if (!entitlement) return Response.json({ error: "Kontingent nicht gefunden." }, { status: 404 });
      }
      if (booking.entitlementId && booking.entitlementId !== nextEntitlementId) {
        await releaseReservedCredit(booking.id, booking.entitlementId);
      }
      if (nextEntitlementId && nextEntitlementId !== booking.entitlementId) {
        await reserveCreditForBooking(booking.id, nextEntitlementId);
      }
      await prisma.booking.update({
        where: { id: booking.id },
        data: { entitlementId: nextEntitlementId, complimentary: false },
      });
      break;
    }
  }

  const updated = await prisma.booking.findUnique({ where: { id: booking.id } });
  return Response.json({ ok: true, booking: updated });
}
