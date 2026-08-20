import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { getClientEntitlements } from "@/lib/creditLedger";
import { CorrectivePlanCard } from "@/components/CorrectivePlanCard";
import UploadForm from "./UploadForm";
import NotesPanel from "./NotesPanel";
import SettingsPanel from "./SettingsPanel";
import AccessGrantForm from "./AccessGrantForm";
import EntitlementsPanel from "./EntitlementsPanel";

export const dynamic = "force-dynamic";

const COMPENSATION_LABELS: Record<string, string> = {
  FEET_TURN_OUT: "Füße drehen nach außen",
  FEET_FLATTEN: "Füße flachen ab",
  KNEES_MOVE_INWARD: "Knie bewegen sich nach innen",
  KNEES_MOVE_OUTWARD: "Knie bewegen sich nach außen",
  EXCESSIVE_FORWARD_LEAN: "Übermäßige Vorlage des Oberkörpers",
  LOW_BACK_ARCHES: "Unterer Rücken hohlt",
  LOW_BACK_ROUNDS: "Unterer Rücken rundet",
  ARMS_FALL_FORWARD: "Arme fallen nach vorne",
  SHOULDER_ELEVATION: "Schulterhochzug",
  SCAPULAR_WINGING: "Scapula-Winging",
  FORWARD_HEAD: "Vorgeschobener Kopf",
  ASYMMETRIC_SHIFT_CERVICAL: "Asymmetrische Halswirbelverschiebung",
  ASYMMETRIC_WEIGHT_SHIFT: "Asymmetrische Gewichtsverlagerung",
  HEELS_RISE: "Fersen heben ab",
};

const STATUS_LABELS: Record<string, string> = {
  LEAD: "Lead",
  ACTIVE: "Aktiv",
  PAUSED: "Pausiert",
  INACTIVE: "Inaktiv",
  ARCHIVED: "Archiviert",
};

const BOOKING_STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "Bestätigt",
  COMPLETED: "Durchgeführt",
  CANCELED: "Storniert",
  NO_SHOW: "No Show",
  RESCHEDULED: "Verschoben",
};

const TABS = [
  { key: "uebersicht", label: "Übersicht" },
  { key: "termine", label: "Termine" },
  { key: "kontingente", label: "Kontingente" },
  { key: "trainingsplaene", label: "Trainingspläne" },
  { key: "scan", label: "SmartMotionScan" },
  { key: "training", label: "Training" },
  { key: "zahlungen", label: "Zahlungen" },
  { key: "notizen", label: "Notizen" },
  { key: "einstellungen", label: "Einstellungen" },
] as const;

// CoachAdmin briefing §4 KUNDENDETAILSEITE — everything reachable from
// one page via a handful of tabs, selected through ?tab= (server-
// rendered, no client state) so the page stays a plain server component
// apart from the few interactive panels below it (Notes/Settings/
// AccessGrant). Termine (P4) and Kontingente (P3) tabs are now backed by
// the real Booking/PackageEntitlement models — see each block below.
// Trainingspläne/Training/Zahlungen tabs are still honest "kommt mit
// Phase PX" stubs; their backing models (TrainingPlanVersion+
// PlanAssignment/Payment) are P5/P7 work, not built in this pass. Where
// an OLDER, differently-shaped model already holds some real data
// (TrainingSession, Order), that tab shows it rather than hiding it.
// Trainingspläne (P5) is now real too — see that tab block below.
export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab = TABS.some((t) => t.key === rawTab) ? rawTab! : "uebersicht";
  const provider = await getActiveProvider();

  const client = await prisma.client.findFirst({
    where: { id, providerId: provider.id },
    include: {
      segmentMemberships: { include: { segment: true } },
      legacyProgram: true,
      accessGrant: true,
      notes: true,
      bookings: { orderBy: { startTime: "desc" }, take: 20, include: { product: { select: { id: true, name: true } } } },
      trainingSessions: { orderBy: { createdAt: "desc" }, take: 20 },
      orders: { orderBy: { createdAt: "desc" }, take: 20, include: { digitalProduct: true } },
      trainingPlans: {
        orderBy: { updatedAt: "desc" },
        include: { assignedFromTemplate: { select: { id: true, title: true } }, _count: { select: { items: true } } },
      },
      movementScans: {
        orderBy: { uploadedAt: "desc" },
        include: {
          findings: true,
          plans: {
            orderBy: { priorityRank: "asc" },
            include: { items: { orderBy: { order: "asc" }, include: { exercise: true } } },
          },
        },
      },
    },
  });

  if (!client) notFound();

  const [allSegments, legacyPrograms, entitlements, packageProducts] = await Promise.all([
    prisma.customerSegment.findMany({ where: { providerId: provider.id }, orderBy: [{ isSystemDefault: "desc" }, { name: "asc" }] }),
    prisma.legacyProgram.findMany({ where: { providerId: provider.id }, orderBy: { createdAt: "asc" } }),
    getClientEntitlements(client.id),
    prisma.product.findMany({
      where: { providerId: provider.id, type: "COACHING_PACKAGE", active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const tabHref = (t: string) => `/admin/customers/${client.id}?tab=${t}`;

  return (
    <main className="flex-1 px-6 py-10 max-w-4xl mx-auto">
      <p className="text-sm text-ink-700/50">
        <Link href="/admin/customers" className="hover:underline">
          ← Kunden
        </Link>
      </p>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink-900">
            {client.firstName} {client.lastName}
          </h1>
          <p className="mt-1 text-sm text-ink-700/70">
            {client.email}
            {client.phone ? ` · ${client.phone}` : ""}
            {client.customerNumber ? ` · ${client.customerNumber}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-ink-900/5 px-2 py-0.5 text-xs font-medium text-ink-700">
              {STATUS_LABELS[client.status] ?? client.status}
            </span>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
            {client.segmentMemberships.map((m: any) => (
              <span key={m.id} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                {m.segment.name}
              </span>
            ))}
            {client.legacyProgram && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                {client.legacyProgram.name}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={tabHref("termine")}
          className="rounded-lg border border-ink-900/15 px-3 py-1.5 text-xs font-medium text-ink-900 hover:bg-ink-900/5"
        >
          Termine ansehen
        </Link>
        <button
          type="button"
          disabled
          title="Kommt mit der Trainingsplan-Verwaltung (Phase P5)"
          className="rounded-lg border border-ink-900/10 px-3 py-1.5 text-xs font-medium text-ink-900/30 cursor-not-allowed"
        >
          Plan zuweisen
        </button>
        <Link
          href={tabHref("scan")}
          className="rounded-lg border border-ink-900/15 px-3 py-1.5 text-xs font-medium text-ink-900 hover:bg-ink-900/5"
        >
          Scan hinzufügen
        </Link>
        <Link
          href={tabHref("einstellungen")}
          className="rounded-lg border border-ink-900/15 px-3 py-1.5 text-xs font-medium text-ink-900 hover:bg-ink-900/5"
        >
          Zugang verwalten
        </Link>
        <button
          type="button"
          disabled
          title="Kommt mit der Rollen-/Audit-Absicherung (Phase P9) — Kundenansicht braucht ein Audit-Log, bevor sie sicher freigegeben werden kann"
          className="rounded-lg border border-ink-900/10 px-3 py-1.5 text-xs font-medium text-ink-900/30 cursor-not-allowed"
        >
          Als Kunde ansehen
        </button>
      </div>

      <div className="mt-8 flex flex-wrap gap-1 border-b border-ink-900/10">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            className={`rounded-t-lg px-3 py-2 text-sm font-medium ${
              tab === t.key ? "bg-white border border-b-0 border-ink-900/10 text-ink-900" : "text-ink-700/60 hover:text-ink-900"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="mt-6">
        {tab === "uebersicht" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink-700/70">
              Kunde seit {client.createdAt.toLocaleDateString("de-DE")}.{" "}
              {client.movementScans.length} SmartMotionScan(s), {client.notes.length} Notiz(en),{" "}
              {client.trainingPlans?.length ?? 0} Trainingsplan(-pläne).
            </p>
            {client.accessGrant && (
              <div className="rounded-lg border border-ink-900/10 p-4 text-sm">
                <p className="font-semibold text-ink-900">Zugang (Beta/Friends-Grant)</p>
                <ul className="mt-1 text-ink-700/70 list-disc list-inside">
                  {client.accessGrant.appAccessGranted && <li>App-Zugang freigegeben</li>}
                  {client.accessGrant.scanResultAccessGranted && <li>Scan-Ergebnis freigegeben</li>}
                  {client.accessGrant.allProductsGranted && <li>Alle Trainingspläne freigegeben</li>}
                  {client.accessGrant.coachingAccessNote && <li>Coaching: {client.accessGrant.coachingAccessNote}</li>}
                  {(client.accessGrant.sessionsGranted || client.accessGrant.sessionsUnlimited) && (
                    <li>
                      {client.accessGrant.sessionsUnlimited
                        ? "Unbegrenzte kostenlose Termine"
                        : `${client.accessGrant.sessionsGranted} kostenlose Termine`}
                    </li>
                  )}
                </ul>
              </div>
            )}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
            {client.notes.filter((n: any) => n.pinned).length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
                <p className="font-semibold text-amber-800">Angepinnte Notizen</p>
                <ul className="mt-1 text-amber-700 list-disc list-inside">
                  {client.notes
                    /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */
                    .filter((n: any) => n.pinned)
                    /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */
                    .map((n: any) => (
                      <li key={n.id}>{n.text}</li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {tab === "termine" && (
          <div>
            <p className="text-sm text-ink-700/60">
              Automatisch aus Calendly synchronisiert (§20). Details, Kontingent-Zuordnung und Aktionen (Durchgeführt/No
              Show/Kulanz) im{" "}
              <Link href="/admin/appointments" className="underline hover:text-brand-700">
                Termine-Bereich
              </Link>
              .
            </p>
            {client.bookings.length === 0 ? (
              <p className="mt-4 text-sm text-ink-700/50">Noch keine Termine.</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
                {client.bookings.map((b: any) => (
                  <li key={b.id}>
                    <Link
                      href={`/admin/appointments/${b.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-900/10 p-3 text-sm hover:bg-ink-900/[0.03]"
                    >
                      <span>
                        {b.startTime.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        {" · "}
                        <span className="text-ink-700/70">{b.product?.name ?? b.calendlyEventName ?? "kein Produkt"}</span>
                      </span>
                      <span className="flex items-center gap-2 text-ink-700/60">
                        {b.complimentary && (
                          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">kostenlos</span>
                        )}
                        {BOOKING_STATUS_LABELS[b.status] ?? b.status}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "kontingente" && (
          <EntitlementsPanel
            clientId={client.id}
            /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */
            entitlements={entitlements.map((ent: any) => ({
              id: ent.id,
              label: ent.label,
              productName: ent.product?.name ?? null,
              unlimited: ent.unlimited,
              active: ent.active,
              expiresAt: ent.expiresAt ? ent.expiresAt.toISOString() : null,
              source: ent.source,
              createdAt: ent.createdAt.toISOString(),
              createdByAdmin: ent.createdByAdmin ? { name: ent.createdByAdmin.name } : null,
              status: {
                total: ent.status.total,
                reserved: ent.status.reserved,
                consumed: ent.status.consumed,
                available: ent.status.available,
              },
              /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */
              ledgerEntries: ent.ledgerEntries.map((e: any) => ({
                id: e.id,
                type: e.type,
                totalDelta: e.totalDelta,
                reservedDelta: e.reservedDelta,
                consumedDelta: e.consumedDelta,
                reason: e.reason,
                createdAt: e.createdAt.toISOString(),
                createdByAdmin: e.createdByAdmin ? { name: e.createdByAdmin.name } : null,
              })),
            }))}
            /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */
            products={packageProducts.map((p: any) => ({ id: p.id, name: p.name, credits: p.credits ?? null }))}
          />
        )}

        {tab === "trainingsplaene" && (
          <div>
            <p className="text-sm text-ink-700/70">
              Individuelle Pläne für diesen Kunden. Neue Pläne per Template + „Duplizieren &amp; Kunde zuweisen“ unter{" "}
              <Link href="/admin/plans?tab=templates" className="underline hover:text-brand-700">
                Trainingspläne
              </Link>
              .
            </p>
            {client.trainingPlans.length === 0 ? (
              <p className="mt-4 text-sm text-ink-700/50">Noch kein Trainingsplan zugewiesen.</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
                {client.trainingPlans.map((p: any) => (
                  <li key={p.id} className="rounded-lg border border-ink-900/10 p-4">
                    <Link href={`/admin/plans/${p.id}`} className="font-medium text-ink-900 hover:underline">
                      {p.title}
                    </Link>
                    <p className="mt-1 text-xs text-ink-700/50">
                      {p._count.items} Übung(en)
                      {p.assignedFromTemplate && <> · aus Template {p.assignedFromTemplate.title}</>}
                      {" · zuletzt geändert "}
                      {p.updatedAt.toLocaleDateString("de-DE")}
                    </p>
                    <span
                      className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.status === "PUBLISHED"
                          ? "bg-brand-100 text-brand-700"
                          : p.status === "ARCHIVED"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {p.status === "PUBLISHED" ? "Veröffentlicht" : p.status === "ARCHIVED" ? "Archiviert" : "Entwurf"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "scan" && (
          <div>
            <section className="rounded-xl border border-ink-900/10 p-6">
              <h2 className="font-semibold">SmartMotionScan hochladen</h2>
              <div className="mt-4">
                <UploadForm clientId={client.id} />
              </div>
            </section>

            <section className="mt-6">
              <h2 className="font-semibold text-lg">Scan- &amp; Plan-Verlauf</h2>
              {client.movementScans.length === 0 ? (
                <p className="mt-3 text-sm text-ink-700/50">Noch keine Scans hochgeladen.</p>
              ) : (
                <div className="mt-4 flex flex-col gap-8">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
                  {client.movementScans.map((scan: any) => (
                    <div key={scan.id} className="rounded-xl border border-ink-900/10 p-6">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-ink-900">{scan.fileName}</p>
                          <p className="text-xs text-ink-700/40">
                            {scan.uploadedAt.toLocaleDateString("de-DE")} · Status: {scan.status}
                          </p>
                        </div>
                      </div>

                      {scan.findings.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold text-ink-700/60">Erfasste Befunde</p>
                          <ul className="mt-1 flex flex-wrap gap-1.5">
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
                            {scan.findings.map((f: any) => (
                              <li key={f.id} className="text-[11px] rounded-full bg-ink-900/5 text-ink-700 px-2 py-0.5">
                                {COMPENSATION_LABELS[f.compensation] ?? f.compensation}
                                {f.side !== "BILATERAL" && ` (${f.side === "LEFT" ? "links" : "rechts"})`}
                                {f.severity && ` · ${f.severity}`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {scan.plans.length > 0 ? (
                        <div className="mt-5 flex flex-col gap-6">
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
                          {scan.plans.map((plan: any) => (
                            <CorrectivePlanCard key={plan.id} plan={plan} />
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-ink-700/50">Kein Plan generiert.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {tab === "training" && (
          <div>
            {client.trainingSessions.length === 0 ? (
              <p className="text-sm text-ink-700/50">
                Noch keine protokollierten Trainingseinheiten. Der vollständige Trainingsplayer mit Pre-/Post-Check-ins
                kommt mit einer späteren Phase.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
                {client.trainingSessions.map((ts: any) => (
                  <li key={ts.id} className="rounded-lg border border-ink-900/10 p-3 text-sm flex justify-between">
                    <span>{ts.scheduledFor ? ts.scheduledFor.toLocaleDateString("de-DE") : "—"}</span>
                    <span className="text-ink-700/60">{ts.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "zahlungen" && (
          <div>
            {client.orders.length === 0 ? (
              <p className="text-sm text-ink-700/50">
                Noch keine Zahlungen. Die vollständige Zahlungsübersicht (Stripe-Spiegel, manuelle Zahlungen, Refunds)
                kommt mit Phase P7.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
                {client.orders.map((o: any) => (
                  <li key={o.id} className="rounded-lg border border-ink-900/10 p-3 text-sm flex justify-between">
                    <span>{o.digitalProduct?.title ?? o.type}</span>
                    <span className="text-ink-700/60">{(o.amountCents / 100).toFixed(2)} €</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "notizen" && (
          <NotesPanel
            clientId={client.id}
            /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */
            notes={client.notes.map((n: any) => ({
              id: n.id,
              text: n.text,
              pinned: n.pinned,
              createdAt: n.createdAt.toISOString(),
              authorId: n.authorId,
            }))}
          />
        )}

        {tab === "einstellungen" && (
          <div className="flex flex-col gap-10">
            <SettingsPanel
              clientId={client.id}
              status={client.status}
              phone={client.phone}
              archivedAt={client.archivedAt ? client.archivedAt.toISOString() : null}
              /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */
              allSegments={allSegments.map((s: any) => ({ id: s.id, name: s.name, isSystemDefault: s.isSystemDefault }))}
              /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */
              memberSegmentIds={client.segmentMemberships.map((m: any) => m.segmentId)}
              /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */
              legacyPrograms={legacyPrograms.map((lp: any) => ({ id: lp.id, name: lp.name }))}
              legacyProgramId={client.legacyProgramId}
            />

            <div id="zugang" className="border-t border-ink-900/10 pt-8">
              <h2 className="font-semibold text-lg text-ink-900">Zugang verwalten (Beta/Friends)</h2>
              <p className="mt-1 text-sm text-ink-700/60">
                Freischaltungen werden nie automatisch aus dem Segment abgeleitet — hier legt der Coach explizit fest,
                was dieser Kunde bekommt.
              </p>
              <div className="mt-4">
                <AccessGrantForm
                  clientId={client.id}
                  grant={
                    client.accessGrant
                      ? {
                          validFrom: client.accessGrant.validFrom ? client.accessGrant.validFrom.toISOString() : null,
                          validUntil: client.accessGrant.validUntil ? client.accessGrant.validUntil.toISOString() : null,
                          appAccessGranted: client.accessGrant.appAccessGranted,
                          scanResultAccessGranted: client.accessGrant.scanResultAccessGranted,
                          allProductsGranted: client.accessGrant.allProductsGranted,
                          coachingAccessNote: client.accessGrant.coachingAccessNote,
                          sessionsGranted: client.accessGrant.sessionsGranted,
                          sessionsUnlimited: client.accessGrant.sessionsUnlimited,
                          specialBookingLinkUrl: client.accessGrant.specialBookingLinkUrl,
                          note: client.accessGrant.note,
                        }
                      : null
                  }
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
