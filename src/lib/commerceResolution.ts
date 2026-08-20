// CoachAdmin briefing §19 (booking-link resolution) + §25/§26 (product
// visibility + price overrides) — the shared logic behind §66's
// constraint that the customer-facing app must have ZERO independent
// business logic of its own. Both admin (for a "so sieht der Kunde es"
// preview) and the customer app import these same functions rather than
// each re-implementing the cascade.
//
// SANDBOX-ONLY, see the top of src/lib/db.ts for why: this file imports
// types from @prisma/client, which isn't generated in this environment.
// Remove the two lines below once `npx prisma generate` can run
// somewhere with normal internet access.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { prisma } from "./db";
import type { Client, Product } from "@prisma/client";

async function segmentIdsFor(clientId: string): Promise<string[]> {
  const memberships = await prisma.customerSegmentMembership.findMany({
    where: { clientId },
    select: { segmentId: true },
  });
  return memberships.map((m) => m.segmentId);
}

export interface ResolvedPrice {
  priceCents: number;
  currency: string;
  source: "customer" | "segment" | "default";
  reasonNote?: string | null;
}

/** §26 Sonderpreise — customer override > segment override > Product.priceCents default. */
export async function resolveProductPrice(product: Product, client: Client): Promise<ResolvedPrice> {
  const customerOverride = await prisma.productPrice.findFirst({
    where: { productId: product.id, customerId: client.id },
  });
  if (customerOverride) {
    return {
      priceCents: customerOverride.priceCents,
      currency: customerOverride.currency,
      source: "customer",
      reasonNote: customerOverride.reasonNote,
    };
  }

  const segmentIds = await segmentIdsFor(client.id);
  if (segmentIds.length > 0) {
    const segmentOverride = await prisma.productPrice.findFirst({
      where: { productId: product.id, segmentId: { in: segmentIds } },
    });
    if (segmentOverride) {
      return {
        priceCents: segmentOverride.priceCents,
        currency: segmentOverride.currency,
        source: "segment",
        reasonNote: segmentOverride.reasonNote,
      };
    }
  }

  return { priceCents: product.priceCents, currency: product.currency, source: "default" };
}

export interface ResolvedBookingLink {
  url: string;
  source: "individual" | "segment-product" | "segment" | "product" | "standard";
}

/** §19 — priority order: individueller Kunden-Link > Segment-Link >
 * Produkt-Link > Standard-Link. The customer never chooses; this always
 * returns the ONE link they should see for a given product (or null if
 * nothing resolves — an honest "noch nicht buchbar" state, not a guess). */
export async function resolveBookingLink(product: Product, client: Client): Promise<ResolvedBookingLink | null> {
  const grant = await prisma.customerAccessGrant.findUnique({ where: { clientId: client.id } });
  if (grant?.specialBookingLinkUrl) {
    return { url: grant.specialBookingLinkUrl, source: "individual" };
  }

  const segmentIds = await segmentIdsFor(client.id);
  if (segmentIds.length > 0) {
    const segmentAndProduct = await prisma.bookingLink.findFirst({
      where: { productId: product.id, segmentId: { in: segmentIds }, active: true },
    });
    if (segmentAndProduct) return { url: segmentAndProduct.url, source: "segment-product" };

    const segmentOnly = await prisma.bookingLink.findFirst({
      where: { productId: null, segmentId: { in: segmentIds }, active: true },
    });
    if (segmentOnly) return { url: segmentOnly.url, source: "segment" };
  }

  const productDefault = await prisma.bookingLink.findFirst({
    where: { productId: product.id, segmentId: null, active: true },
  });
  if (productDefault) return { url: productDefault.url, source: "product" };

  const standard = await prisma.bookingLink.findFirst({
    where: { productId: null, segmentId: null, active: true },
  });
  if (standard) return { url: standard.url, source: "standard" };

  return null;
}

/** §25 — ALL (subject to the visibleToCustomers kill-switch) / SEGMENTS
 * (client must be in one of the ProductAccessRule-listed segments) /
 * CUSTOMERS (client must have their own ProductAccessRule row). */
export async function isProductVisibleTo(product: Product, client: Client): Promise<boolean> {
  if (!product.active || !product.visibleToCustomers) return false;
  if (product.visibility === "ALL") return true;

  if (product.visibility === "CUSTOMERS") {
    const rule = await prisma.productAccessRule.findFirst({ where: { productId: product.id, customerId: client.id } });
    return Boolean(rule);
  }

  // SEGMENTS
  const segmentIds = await segmentIdsFor(client.id);
  if (segmentIds.length === 0) return false;
  const rule = await prisma.productAccessRule.findFirst({
    where: { productId: product.id, segmentId: { in: segmentIds } },
  });
  return Boolean(rule);
}
