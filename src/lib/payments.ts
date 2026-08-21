// CoachAdmin briefing §28-§31 — Zahlungen. Payment/Refund are a MIRROR of
// what Stripe (or a manual sale) did (see the doc comment on the Payment
// model in schema.prisma) — this file is deliberately thin: it never moves
// money, only records that a payment happened and, for entitlement-backed
// products, delegates the actual "what does this customer now own" work to
// src/lib/creditLedger.ts's createManualEntitlement()/setEntitlementActive()
// rather than duplicating that logic here.
//
// SANDBOX-ONLY, see the top of src/lib/db.ts for why: this file imports
// types from @prisma/client, which isn't generated in this environment.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { prisma } from "./db";
import { createManualEntitlement, setEntitlementActive } from "./creditLedger";

/** §30 "Zahlung manuell hinzufügen": Banküberweisung/Barzahlung/Rechnung
 * extern/Kulanz/kostenlos. "Danach entsprechendes Entitlement erstellen" —
 * when the payment is for a COACHING_PACKAGE product (or the caller passes
 * explicit credits), this creates a brand-new PackageEntitlement via the
 * existing P3 primitive (never a top-up of an existing one, same §16 rule)
 * and links it back onto the Payment row. */
export async function recordManualPayment(params: {
  providerId: string;
  clientId: string;
  productId?: string | null;
  listPriceCents: number;
  discountCents?: number;
  amountCents: number;
  method: "BANK_TRANSFER" | "CASH" | "EXTERNAL_INVOICE" | "GOODWILL" | "FREE";
  status?: "PAID" | "PENDING" | "COMPLIMENTARY" | "MANUAL";
  note?: string | null;
  paidAt?: Date;
  adminId: string;
  // Entitlement to grant alongside this payment, if any (§30's "danach
  // entsprechendes Entitlement erstellen"). Omit for payments that don't
  // grant a Kontingent (e.g. a one-off digital plan already handled via
  // the Order model, or a SmartMotionScan which has no entitlement concept).
  grantEntitlement?: {
    label: string;
    totalCredits: number;
    unlimited?: boolean;
    expiresAt?: Date | null;
  } | null;
}) {
  const entitlement = params.grantEntitlement
    ? await createManualEntitlement({
        clientId: params.clientId,
        productId: params.productId ?? null,
        label: params.grantEntitlement.label,
        totalCredits: params.grantEntitlement.totalCredits,
        unlimited: params.grantEntitlement.unlimited ?? false,
        expiresAt: params.grantEntitlement.expiresAt ?? null,
        note: `Zahlung: ${params.note ?? params.method}`,
        adminId: params.adminId,
      })
    : null;

  return prisma.payment.create({
    data: {
      providerId: params.providerId,
      clientId: params.clientId,
      productId: params.productId ?? null,
      entitlementId: entitlement?.id ?? null,
      listPriceCents: params.listPriceCents,
      discountCents: params.discountCents ?? 0,
      amountCents: params.amountCents,
      method: params.method,
      status: params.status ?? (params.method === "FREE" ? "COMPLIMENTARY" : "PAID"),
      note: params.note ?? null,
      paidAt: params.paidAt ?? new Date(),
      createdByAdminId: params.adminId,
    },
  });
}

/** §31 Refunds — "nicht automatisch immer das Produkt entziehen", the
 * admin decides `keepAccess` per refund. When access is removed and the
 * payment has a linked entitlement, the entitlement is deactivated (never
 * deleted/rewritten) so already-consumed sessions stay in the ledger's
 * history, per §31's own worked example. Payment.status becomes REFUNDED
 * once the sum of all refunds on it reaches amountCents, otherwise
 * PARTIALLY_REFUNDED. */
export async function refundPayment(params: {
  paymentId: string;
  amountCents: number;
  keepAccess: boolean;
  reason: string;
  adminId: string;
}) {
  const reason = params.reason.trim();
  if (!reason) throw new Error("Grund ist erforderlich.");
  if (!Number.isFinite(params.amountCents) || params.amountCents <= 0) {
    throw new Error("Betrag muss größer als 0 sein.");
  }

  const payment = await prisma.payment.findUnique({
    where: { id: params.paymentId },
    include: { refunds: true },
  });
  if (!payment) throw new Error("Zahlung nicht gefunden.");

  const refund = await prisma.refund.create({
    data: {
      paymentId: params.paymentId,
      amountCents: params.amountCents,
      keepAccess: params.keepAccess,
      reason,
      refundedByAdminId: params.adminId,
    },
  });

  const alreadyRefunded = payment.refunds.reduce((sum: number, r: { amountCents: number }) => sum + r.amountCents, 0);
  const totalRefunded = alreadyRefunded + params.amountCents;
  const newStatus = totalRefunded >= payment.amountCents ? "REFUNDED" : "PARTIALLY_REFUNDED";

  await prisma.payment.update({
    where: { id: params.paymentId },
    data: { status: newStatus },
  });

  if (!params.keepAccess && payment.entitlementId) {
    await setEntitlementActive(payment.entitlementId, false);
  }

  return refund;
}

/** Sum of `amountCents` for payments counted as real revenue (§28/§50) —
 * PAID and PARTIALLY_REFUNDED count (money that actually stayed), REFUNDED/
 * FAILED/PENDING/COMPLIMENTARY/MANUAL do not. `MANUAL` is deliberately
 * excluded here even though money may have changed hands, because it's the
 * status a coach uses for entries still awaiting classification — once
 * classified they should carry PAID or COMPLIMENTARY instead. */
export async function getRevenueCents(providerId: string, from: Date, to: Date): Promise<number> {
  const result = await prisma.payment.aggregate({
    where: {
      providerId,
      paidAt: { gte: from, lt: to },
      status: { in: ["PAID", "PARTIALLY_REFUNDED"] },
    },
    _sum: { amountCents: true },
  });
  return result._sum.amountCents ?? 0;
}
