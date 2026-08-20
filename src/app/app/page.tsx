import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentClient } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAggregatedCreditsByProduct } from "@/lib/creditLedger";
import { CorrectivePlanCard } from "@/components/CorrectivePlanCard";

// Hits the database directly and doesn't itself call cookies()/headers()
// in its own render path (getCurrentClient does, but that alone doesn't
// guarantee Next treats this as dynamic) — see the same force-dynamic
// note on /clients/page.tsx.
export const dynamic = "force-dynamic";

// Client-facing home base: everything a registered client is allowed to
// do lives here or one click away (see nav in layout.tsx) — book a
// session (home page), see how many sessions they have left and when the
// next one is, download their SmartMotionScan report(s), see training
// plans they've bought, and train the corrective-exercise plan(s) the
// coach generated from their scan. Deliberately NOT here: the exercise
// library or any way to build/edit a plan themselves (see
// src/lib/auth.ts#redirectIfClientLoggedIn for the routes that are
// blocked for a logged-in client).
export default async function PortalPage() {
  const client = await getCurrentClient();
  if (!client) redirect("/login?redirectTo=/app");

  const [creditGroups, nextBooking, scans, digitalOrders, plans] = await Promise.all([
    // P3: derived from the Kontingent-Ledger (src/lib/creditLedger.ts),
    // not the old CreditBalance model — see that model's schema.prisma
    // comment for why it's kept around unused rather than removed.
    getAggregatedCreditsByProduct(client.id),
    prisma.booking.findFirst({
      where: { clientId: client.id, status: "CONFIRMED", startTime: { gte: new Date() } },
      orderBy: { startTime: "asc" },
    }),
    prisma.movementScan.findMany({
      where: { clientId: client.id },
      orderBy: { uploadedAt: "desc" },
    }),
    prisma.order.findMany({
      where: { clientId: client.id, type: "DIGITAL_PRODUCT" },
      include: { digitalProduct: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.correctivePlan.findMany({
      where: { clientId: client.id },
      orderBy: [{ generatedAt: "desc" }, { priorityRank: "asc" }],
      include: {
        items: { orderBy: { order: "asc" }, include: { exercise: true } },
        movementScan: true,
      },
    }),
  ]);

  // `: any` annotations below are SANDBOX-ONLY, see src/lib/db.ts —
  // @prisma/client's generated types don't exist in this environment.
  /* eslint-disable @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */
  const hasUnlimited = creditGroups.some((g) => g.available === Infinity);
  const totalCreditsRemaining = hasUnlimited
    ? Infinity
    : creditGroups.reduce((sum, g) => sum + g.available, 0);
  // §17 — earliest upcoming expiry across all groups still holding credit, shown as a heads-up banner.
  const nearestExpiry = creditGroups.reduce((earliest: Date | null, g) => {
    if (!g.nearestExpiry) return earliest;
    return !earliest || g.nearestExpiry < earliest ? g.nearestExpiry : earliest;
  }, null);
  const latestScanId = plans[0]?.movementScanId;
  const currentPlans = plans.filter((p: any) => p.movementScanId === latestScanId);
  const historicalPlans = plans.filter((p: any) => p.movementScanId !== latestScanId);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (
    <main className="flex-1 max-w-3xl mx-auto px-6 py-16">
      <h1 className="font-serif text-3xl font-bold text-ink-900">Hallo {client.firstName}!</h1>
      <p className="mt-2 text-ink-700/80">
        Dein persönlicher Bereich — Termine, Einheiten, Scanbericht und Trainingspläne auf einen
        Blick.
      </p>

      {/* Status overview: sessions left + next appointment */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-ink-900/10 bg-white/50 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
            Verbleibende Einheiten
          </p>
          {creditGroups.length === 0 ? (
            <p className="mt-2 text-sm text-ink-700/60">
              Keine aktiven Pakete. Sessions &amp; Pakete findest du auf der Startseite.
            </p>
          ) : (
            <>
              <p className="mt-2 font-serif text-3xl font-bold text-ink-900">
                {hasUnlimited ? "∞" : totalCreditsRemaining}
              </p>
              <ul className="mt-2 text-sm text-ink-700/70">
                {creditGroups.map((g) => (
                  <li key={g.productId ?? g.productName}>
                    {g.available === Infinity ? "Unbegrenzt" : g.available}× {g.productName}
                  </li>
                ))}
              </ul>
              {nearestExpiry && (
                <p className="mt-2 text-xs text-amber-600">
                  Dein Paket läuft am {nearestExpiry.toLocaleDateString("de-DE")} ab.
                </p>
              )}
            </>
          )}
        </div>

        <div className="rounded-xl border border-ink-900/10 bg-white/50 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
            Nächster Termin
          </p>
          {nextBooking ? (
            <p className="mt-2 font-serif text-xl font-bold text-ink-900">
              {nextBooking.startTime.toLocaleString("de-DE", {
                weekday: "short",
                day: "2-digit",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              Uhr
            </p>
          ) : (
            <p className="mt-2 text-sm text-ink-700/60">
              Kein anstehender Termin gebucht.{" "}
              <Link href="/app/appointments" className="text-brand-700 underline">
                Jetzt buchen
              </Link>
              .
            </p>
          )}
        </div>
      </div>

      {/* Scan reports */}
      <section className="mt-10">
        <h2 className="font-serif text-lg font-bold text-ink-900">Deine Scanberichte</h2>
        {scans.length === 0 ? (
          <p className="mt-3 text-sm text-ink-700/60">
            Noch kein SmartMotionScan hochgeladen. Sobald dein Trainer einen Bericht hochlädt,
            erscheint er hier zum Download.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
            {scans.map((scan: any) => (
              <li
                key={scan.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-ink-900/10 bg-white/50 p-4"
              >
                <div>
                  <p className="font-medium text-ink-900">{scan.fileName}</p>
                  <p className="text-xs text-ink-700/60">
                    {scan.uploadedAt.toLocaleDateString("de-DE")}
                  </p>
                </div>
                <a
                  href={`/api/scans/${scan.id}/download`}
                  className="shrink-0 rounded-lg bg-brand-600 text-white px-3 py-1.5 text-sm font-semibold hover:bg-brand-700"
                >
                  Herunterladen
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Purchased training plans */}
      <section className="mt-10">
        <h2 className="font-serif text-lg font-bold text-ink-900">Gekaufte Trainingspläne</h2>
        {digitalOrders.length === 0 ? (
          <p className="mt-3 text-sm text-ink-700/60">
            Noch keine Trainingspläne gekauft.{" "}
            <Link href="/app/shop" className="text-brand-700 underline">
              Trainingspläne ansehen
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
            {digitalOrders.map((order: any) => (
              <li
                key={order.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-ink-900/10 bg-white/50 p-4"
              >
                <p className="font-medium text-ink-900">{order.digitalProduct?.title}</p>
                {order.digitalProduct?.fileUrl && (
                  <a
                    href={order.digitalProduct.fileUrl}
                    className="shrink-0 rounded-lg bg-brand-600 text-white px-3 py-1.5 text-sm font-semibold hover:bg-brand-700"
                  >
                    Öffnen
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Corrective plan(s) from the scan — the trainable content */}
      <section className="mt-10">
        <h2 className="font-serif text-lg font-bold text-ink-900">Dein Corrective-Exercise-Plan</h2>
        {plans.length === 0 ? (
          <p className="mt-3 text-sm text-ink-700/60">
            Dein Trainer hat noch keinen Corrective-Exercise-Plan für dich hochgeladen. Sobald ein
            SmartMotionScan ausgewertet wurde, erscheint dein individueller Plan hier automatisch.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-ink-700/70">
              Automatisch erstellt aus deinem letzten SmartMotionScan
              {currentPlans[0]?.generatedAt && (
                <> vom {currentPlans[0].generatedAt.toLocaleDateString("de-DE")}</>
              )}
              .
            </p>

            {currentPlans.length > 1 && (
              <p className="mt-3 rounded-lg bg-brand-50 text-brand-700 text-sm p-3">
                Dein Scan hat mehrere Befunde ergeben — dein Trainer hat deshalb {currentPlans.length}{" "}
                Pläne erstellt. Wechsle zwischen ihnen an unterschiedlichen Trainingstagen ab.
              </p>
            )}

            <div className="mt-6 flex flex-col gap-10">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
              {currentPlans.map((plan: any) => (
                <CorrectivePlanCard key={plan.id} plan={plan} />
              ))}
            </div>

            {historicalPlans.length > 0 && (
              <div className="mt-10 border-t border-ink-900/10 pt-8">
                <h3 className="text-sm font-semibold text-ink-700/70">Ältere Pläne</h3>
                <div className="mt-4 flex flex-col gap-3">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
                  {historicalPlans.map((plan: any) => (
                    <details key={plan.id} className="rounded-lg border border-ink-900/10 p-4">
                      <summary className="cursor-pointer text-sm font-medium text-ink-700">
                        {plan.label ?? "Plan"} · {plan.generatedAt.toLocaleDateString("de-DE")} (
                        {plan.items.length} Übungen)
                      </summary>
                      <div className="mt-4">
                        <CorrectivePlanCard plan={plan} compact />
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
