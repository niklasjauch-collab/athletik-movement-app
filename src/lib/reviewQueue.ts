// CoachAdmin briefing §60 REVIEW QUEUE — "Auf Dashboard: Zu prüfen".
//
// Seven categories the spec names verbatim: Unmatched Booking, Unmatched
// Payment, Scan ohne Plan, Plan Draft, Exercise Missing Video, Customer
// Without Access, Package Balance Conflict. Two of these ("Unmatched
// Booking", "Scan ohne Plan") already existed as separate ad-hoc dashboard
// counts since P4/P6 — this file is the single §66-SSOT place all seven
// now live, so the dashboard widget and any future page reuse the exact
// same definitions instead of drifting.
//
// Two categories don't map 1:1 onto the schema, since the briefing was
// written before the concrete data model existed — documented, pragmatic
// interpretations (same spirit as §21/§36's own adaptations in P4/P6):
//   - "Unmatched Payment": Payment has no equivalent of Booking's nullable
//     clientId (every Payment requires a resolved Client to exist at all —
//     §56 deliberately keeps Payment scoped to a known customer). Read
//     instead as "a payment that didn't cleanly resolve": status PENDING/
//     FAILED, or a Stripe payment with no productId (checkout completed
//     but nothing could be sold/entitled from it).
//   - "Package Balance Conflict": an entitlement whose computed available
//     credit (§12 formula, via creditLedger.ts's computeStatus()) has gone
//     negative — should never happen if reservation/consumption logic is
//     correct, but the spec explicitly wants this surfaced as a signal
//     something upstream went wrong, not silently ignored.
//
// SANDBOX-ONLY, see the top of src/lib/db.ts for why this needs @ts-nocheck.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { prisma } from "./db";
import { computeStatus } from "./creditLedger";

export interface ReviewQueueCounts {
  unmatchedBookings: number;
  unmatchedPayments: number;
  scansWithoutPlan: number;
  draftPlans: number;
  exercisesMissingVideo: number;
  customersWithoutAccess: number;
  packageBalanceConflicts: number;
}

export const REVIEW_QUEUE_TOTAL = (c: ReviewQueueCounts) =>
  c.unmatchedBookings +
  c.unmatchedPayments +
  c.scansWithoutPlan +
  c.draftPlans +
  c.exercisesMissingVideo +
  c.customersWithoutAccess +
  c.packageBalanceConflicts;

/** Cheap, count-only version for the dashboard KPI/widget. */
export async function getReviewQueueCounts(providerId: string): Promise<ReviewQueueCounts> {
  const [
    unmatchedBookings,
    unmatchedPayments,
    scansWithoutPlan,
    draftPlans,
    exercises,
    customersWithoutAccess,
    conflictCandidates,
  ] = await Promise.all([
    prisma.booking.count({
      where: {
        AND: [
          { OR: [{ client: { providerId } }, { clientId: null }] },
          { complimentary: false },
          { OR: [{ clientId: null }, { productId: null }] },
        ],
      },
    }),
    prisma.payment.count({
      where: {
        providerId,
        OR: [{ status: { in: ["PENDING", "FAILED"] } }, { method: "STRIPE", productId: null }],
      },
    }),
    prisma.movementScan.count({ where: { providerId, plans: { none: {} } } }),
    prisma.trainingPlan.count({ where: { providerId, status: "DRAFT", kind: { in: ["INDIVIDUAL", "SELLABLE"] } } }),
    prisma.exercise.findMany({
      where: { providerId },
      select: { videoMaleUrl: true, videoFemaleUrl: true, videoMalePath: true, videoFemalePath: true },
    }),
    prisma.client.count({
      where: {
        providerId,
        status: "ACTIVE",
        packageEntitlements: { none: { active: true } },
        OR: [{ accessGrant: null }, { accessGrant: { appAccessGranted: false } }],
      },
    }),
    prisma.packageEntitlement.findMany({
      where: { client: { providerId }, active: true, unlimited: false },
      include: { ledgerEntries: true },
    }),
  ]);

  const exercisesMissingVideo = exercises.filter(
    (e) => !e.videoMaleUrl && !e.videoFemaleUrl && !e.videoMalePath && !e.videoFemalePath,
  ).length;

  const packageBalanceConflicts = conflictCandidates.filter(
    (ent) => computeStatus(ent, ent.ledgerEntries).available < 0,
  ).length;

  return {
    unmatchedBookings,
    unmatchedPayments,
    scansWithoutPlan,
    draftPlans,
    exercisesMissingVideo,
    customersWithoutAccess,
    packageBalanceConflicts,
  };
}
