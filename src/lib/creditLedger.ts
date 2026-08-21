// CoachAdmin briefing §11-§17 — the Kontingent-Ledger engine. Every
// PackageEntitlement's Gesamt/Verbraucht/Reserviert/Verfügbar (§12) is
// ALWAYS derived here by summing its CreditLedgerEntry rows — nothing in
// this codebase should read/write a cached "creditsRemaining"-style
// column for entitlements created after P3 (Runde 5 Teil 5). Both the
// admin "Kontingente" tab and the customer portal import these same
// functions, matching the §66 single-source-of-truth pattern already
// used by commerceResolution.ts.
//
// SANDBOX-ONLY, see the top of src/lib/db.ts for why: this file imports
// types from @prisma/client, which isn't generated in this environment.
// Remove the two lines below once `npx prisma generate` can run
// somewhere with normal internet access.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { prisma } from "./db";
import type { CustomerAccessGrant } from "@prisma/client";

export interface EntitlementStatus {
  total: number;
  reserved: number;
  consumed: number;
  available: number; // Infinity when unlimited
  unlimited: boolean;
}

/** §12 formula: available = total - consumed - reserved. `unlimited`
 * entitlements report Infinity for available regardless of the ledger sum
 * (the ledger still records usage underneath, for the audit trail — it
 * just never gates availability). */
export function computeStatus(
  entitlement: { unlimited: boolean },
  entries: Array<{ totalDelta: number; reservedDelta: number; consumedDelta: number }>,
): EntitlementStatus {
  let total = 0;
  let reserved = 0;
  let consumed = 0;
  for (const e of entries) {
    total += e.totalDelta;
    reserved += e.reservedDelta;
    consumed += e.consumedDelta;
  }
  const available = entitlement.unlimited ? Infinity : total - consumed - reserved;
  return { total, reserved, consumed, available, unlimited: entitlement.unlimited };
}

/** All of a client's entitlements (active and inactive — the "Kontingente"
 * tab shows both, inactive ones dimmed, per §14's "keine stillen
 * Änderungen": deactivating never hides history) with their computed
 * status and full ledger history, newest entitlement first. */
export async function getClientEntitlements(clientId: string) {
  const entitlements = await prisma.packageEntitlement.findMany({
    where: { clientId },
    include: {
      product: true,
      createdByAdmin: { select: { id: true, name: true } },
      ledgerEntries: {
        orderBy: { createdAt: "asc" },
        include: { createdByAdmin: { select: { id: true, name: true } } },
      },
    },
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
  });

  return entitlements.map((ent) => ({
    ...ent,
    status: computeStatus(ent, ent.ledgerEntries),
  }));
}

export interface AggregatedCredit {
  productId: string | null;
  productName: string;
  available: number; // Infinity when any contributing entitlement is unlimited
  unlimited: boolean;
  nearestExpiry: Date | null; // earliest expiresAt among entitlements that still have available credit
}

/** Client-portal view (§66 single source of truth — /app/page.tsx must
 * never re-derive this itself): active entitlements grouped by product
 * (or by their free-text label when there's no product), summed into one
 * "X verbleibend" line per group, plus the nearest upcoming expiry worth
 * warning the client about (§17: "Dein Paket läuft am XX.XX.XXXX aus."). */
export async function getAggregatedCreditsByProduct(clientId: string): Promise<AggregatedCredit[]> {
  const entitlements = await getClientEntitlements(clientId);
  const groups = new Map<string, AggregatedCredit>();

  for (const ent of entitlements) {
    if (!ent.active) continue;
    if (ent.status.available <= 0 && !ent.unlimited) continue;

    const key = ent.productId ?? `label:${ent.label}`;
    const existing = groups.get(key);
    const name = ent.product?.name ?? ent.label;

    if (!existing) {
      groups.set(key, {
        productId: ent.productId,
        productName: name,
        available: ent.status.available,
        unlimited: ent.unlimited,
        nearestExpiry: ent.expiresAt,
      });
    } else {
      existing.unlimited = existing.unlimited || ent.unlimited;
      existing.available = existing.unlimited ? Infinity : existing.available + ent.status.available;
      if (ent.expiresAt && (!existing.nearestExpiry || ent.expiresAt < existing.nearestExpiry)) {
        existing.nearestExpiry = ent.expiresAt;
      }
    }
  }

  return Array.from(groups.values());
}

/** §16 — always a NEW entitlement, never a merge into an existing one.
 * Also the general "grant a package manually" path, since P7 (Stripe)
 * doesn't exist yet — this is how Niklas records an offline/manual sale
 * or a legacy top-up today. Also reused (P7) by the Stripe webhook for a
 * real `stripe_checkout`-sourced purchase — `adminId` is optional there
 * (a webhook has no admin session; `createdByAdminId` stays null rather
 * than being forced to some placeholder AdminUser id, which would be a
 * misleading audit trail entry). Writes one PACKAGE_PURCHASE ledger
 * entry. */
export async function createManualEntitlement(params: {
  clientId: string;
  productId?: string | null;
  label: string;
  totalCredits: number;
  unlimited?: boolean;
  expiresAt?: Date | null;
  note?: string | null;
  adminId?: string | null;
  source?: string;
}) {
  const entitlement = await prisma.packageEntitlement.create({
    data: {
      clientId: params.clientId,
      productId: params.productId ?? null,
      label: params.label,
      unlimited: params.unlimited ?? false,
      expiresAt: params.expiresAt ?? null,
      source: params.source ?? "manual_grant",
      createdByAdminId: params.adminId ?? null,
      ledgerEntries: {
        create: {
          type: "PACKAGE_PURCHASE",
          totalDelta: params.unlimited ? 0 : params.totalCredits,
          reason: params.note ?? "Manuell vergeben",
          createdByAdminId: params.adminId ?? null,
        },
      },
    },
  });
  return entitlement;
}

export type AdjustBucket = "TOTAL" | "CONSUMED";

/** §14 Manuelle Kontingentkorrektur — "Jede Änderung braucht: Wert, Grund,
 * Admin, Datum. Keine stillen Änderungen." `bucket` picks which of the
 * briefing's own examples this is: "Gesamt" for +1 Kulanz / +5 Altbestand,
 * "Verbraucht" for -1 manuell durchgeführt / -1 No Show (both mark a
 * credit as used without an actual synced Booking, since P4 doesn't exist
 * yet). `delta` is signed either way (+/-). Throws if `reason` is empty —
 * this function is the one place that rule is enforced, not just the UI. */
export async function adjustEntitlement(params: {
  entitlementId: string;
  bucket: AdjustBucket;
  delta: number;
  reason: string;
  adminId: string;
}) {
  const reason = params.reason.trim();
  if (!reason) throw new Error("Grund ist erforderlich.");
  if (!Number.isFinite(params.delta) || params.delta === 0) throw new Error("Wert muss ungleich 0 sein.");

  return prisma.creditLedgerEntry.create({
    data: {
      entitlementId: params.entitlementId,
      type: "MANUAL_ADJUSTMENT",
      totalDelta: params.bucket === "TOTAL" ? params.delta : 0,
      consumedDelta: params.bucket === "CONSUMED" ? params.delta : 0,
      reason,
      createdByAdminId: params.adminId,
    },
  });
}

/** §17 — admin can set, extend, or remove (null) an expiry at any time.
 * Not a credit change, so no ledger entry — just an editable field. */
export async function setEntitlementExpiry(entitlementId: string, expiresAt: Date | null) {
  return prisma.packageEntitlement.update({ where: { id: entitlementId }, data: { expiresAt } });
}

export async function setEntitlementActive(entitlementId: string, active: boolean) {
  return prisma.packageEntitlement.update({ where: { id: entitlementId }, data: { active } });
}

/** Keeps CustomerAccessGrant's `sessionsGranted`/`sessionsUnlimited`
 * (§9 Freunde/Family, built in P1) in sync with a real PackageEntitlement,
 * closing the loop that CustomerAccessGrant's own doc comment in
 * schema.prisma flags as P3 work — before this, those two fields were
 * only ever the coach's recorded INTENT, never an actual usable credit.
 * Idempotent via `linkedAccessGrantId` (unique): safe to call on every
 * access-grant save and again from seed.ts for pre-existing grants.
 * Never deletes the entitlement if sessions are later revoked — sets
 * `active:false` instead, preserving its ledger history (§14). */
export async function syncAccessGrantEntitlement(
  clientId: string,
  grant: Pick<CustomerAccessGrant, "sessionsGranted" | "sessionsUnlimited">,
  adminId?: string | null,
) {
  const existing = await prisma.packageEntitlement.findFirst({
    where: { clientId, source: "access_grant_sync" },
    include: { ledgerEntries: true },
  });

  const wantsGrant = grant.sessionsUnlimited || (grant.sessionsGranted ?? 0) > 0;

  if (!wantsGrant) {
    if (existing?.active) await setEntitlementActive(existing.id, false);
    return existing ?? null;
  }

  const targetTotal = grant.sessionsUnlimited ? 0 : (grant.sessionsGranted ?? 0);
  const label = grant.sessionsUnlimited ? "Freigabe: unbegrenzte Termine" : "Freigabe: kostenlose Termine";

  if (!existing) {
    return prisma.packageEntitlement.create({
      data: {
        clientId,
        label,
        unlimited: grant.sessionsUnlimited,
        source: "access_grant_sync",
        linkedAccessGrantId: clientId, // one grant per client (CustomerAccessGrant.clientId is @unique), so clientId doubles as a stable idempotency key
        createdByAdminId: adminId ?? null,
        ledgerEntries: {
          create: {
            type: "PACKAGE_PURCHASE",
            totalDelta: targetTotal,
            reason: "Automatisch aus Zugang-Freigabe synchronisiert",
            createdByAdminId: adminId ?? null,
          },
        },
      },
    });
  }

  const status = computeStatus(existing, existing.ledgerEntries);
  const needsReactivate = !existing.active;
  const unlimitedChanged = existing.unlimited !== grant.sessionsUnlimited;
  const totalDrift = grant.sessionsUnlimited ? 0 : targetTotal - status.total;

  if (needsReactivate || unlimitedChanged) {
    await prisma.packageEntitlement.update({
      where: { id: existing.id },
      data: { active: true, unlimited: grant.sessionsUnlimited, label },
    });
  }
  if (totalDrift !== 0) {
    await prisma.creditLedgerEntry.create({
      data: {
        entitlementId: existing.id,
        type: "MANUAL_ADJUSTMENT",
        totalDelta: totalDrift,
        reason: "Automatisch aus Zugang-Freigabe synchronisiert",
        createdByAdminId: adminId ?? null,
      },
    });
  }
  return existing;
}

// --- §13 Terminlogik für Kontingente — the reservation engine. Nothing
// calls these yet (Booking rows aren't created by any real flow until P4
// Calendly-Sync exists), but they're written now so P4's webhook handler
// only has to call in, not design this. Each is a single ledger entry,
// keeping every state transition auditable and reversible. ---

/** Calendly-Termin gebucht → Credit wird RESERVED. */
export async function reserveCreditForBooking(bookingId: string, entitlementId: string) {
  return prisma.creditLedgerEntry.create({
    data: { entitlementId, bookingId, type: "BOOKING_RESERVED", reservedDelta: 1 },
  });
}

/** Termin rechtzeitig abgesagt/verschoben-und-freigegeben → Credit wird wieder AVAILABLE. */
export async function releaseReservedCredit(bookingId: string, entitlementId: string) {
  return prisma.creditLedgerEntry.create({
    data: { entitlementId, bookingId, type: "BOOKING_CANCELLED", reservedDelta: -1 },
  });
}

/** Termin erfolgreich durchgeführt (or a configurable no-show/late-cancel
 * per Product.consumeCreditOnNoShow/consumeCreditOnLateCancel) → Credit
 * wird CONSUMED. */
export async function completeCreditForBooking(bookingId: string, entitlementId: string) {
  return prisma.creditLedgerEntry.create({
    data: { entitlementId, bookingId, type: "SESSION_COMPLETED", reservedDelta: -1, consumedDelta: 1 },
  });
}
