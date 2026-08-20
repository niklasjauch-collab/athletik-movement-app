import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { computeStatus } from "@/lib/creditLedger";
import AppointmentActions from "./AppointmentActions";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "Bestätigt",
  COMPLETED: "Durchgeführt",
  CANCELED: "Storniert",
  NO_SHOW: "No Show",
  RESCHEDULED: "Verschoben",
};

// CoachAdmin briefing §23 TERMINDETAILS.
export default async function AppointmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const provider = await getActiveProvider();

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      client: true,
      product: true,
      bookingLink: true,
      entitlement: { include: { ledgerEntries: true } },
    },
  });
  if (!booking) notFound();

  const status = booking.entitlement ? computeStatus(booking.entitlement, booking.entitlement.ledgerEntries) : null;

  const [clients, products, clientEntitlements] = await Promise.all([
    prisma.client.findMany({
      where: { providerId: provider.id },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, email: true },
      take: 500,
    }),
    prisma.product.findMany({
      where: { providerId: provider.id, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, type: true },
    }),
    booking.clientId
      ? prisma.packageEntitlement.findMany({
          where: { clientId: booking.clientId, active: true },
          include: { ledgerEntries: true, product: true },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <main className="flex-1 px-6 py-10 max-w-3xl mx-auto">
      <p className="text-sm text-ink-700/50">
        <Link href="/admin/appointments" className="hover:underline">
          ← Termine
        </Link>
      </p>

      <h1 className="mt-2 font-serif text-3xl font-bold text-ink-900">
        {booking.startTime.toLocaleString("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })} Uhr
      </h1>
      <p className="mt-1 text-sm text-ink-700/70">
        Status: <span className="font-medium">{STATUS_LABELS[booking.status] ?? booking.status}</span>
        {booking.complimentary && <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">kostenlos</span>}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-ink-900/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/40">Kunde</p>
          {booking.client ? (
            <Link href={`/admin/customers/${booking.client.id}`} className="mt-1 block font-medium text-ink-900 hover:underline">
              {booking.client.firstName} {booking.client.lastName}
            </Link>
          ) : (
            <p className="mt-1 text-amber-700">
              {booking.inviteeName ?? "Unbekannt"} {booking.inviteeEmail ? `(${booking.inviteeEmail})` : ""} — kein Kunde zugeordnet
            </p>
          )}
        </div>

        <div className="rounded-xl border border-ink-900/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/40">Produkt</p>
          {booking.product ? (
            <p className="mt-1 font-medium text-ink-900">{booking.product.name}</p>
          ) : (
            <p className="mt-1 text-amber-700">{booking.calendlyEventName ?? "kein Produkt zugeordnet"}</p>
          )}
        </div>

        <div className="rounded-xl border border-ink-900/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/40">Paket / Kontingentstatus</p>
          {booking.entitlement && status ? (
            <p className="mt-1 text-sm text-ink-900">
              {booking.entitlement.label}
              <br />
              <span className="text-ink-700/70">
                {booking.entitlement.unlimited
                  ? "Unbegrenzt"
                  : `${status.available} verfügbar · ${status.reserved} reserviert · ${status.consumed} verbraucht`}
              </span>
            </p>
          ) : (
            <p className="mt-1 text-ink-700/50">{booking.complimentary ? "Kostenlos, kein Kontingent belastet" : "Kein Kontingent zugeordnet"}</p>
          )}
        </div>

        <div className="rounded-xl border border-ink-900/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/40">Zahlungsstatus</p>
          <p className="mt-1 text-ink-700/50">Kommt mit Phase P7 (Stripe/Zahlungen).</p>
        </div>

        <div className="rounded-xl border border-ink-900/10 p-4 sm:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/40">Calendly</p>
          <div className="mt-1 flex flex-wrap gap-4 text-sm">
            {booking.cancelUrl && (
              <a href={booking.cancelUrl} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">
                Stornierungslink
              </a>
            )}
            {booking.rescheduleUrl && (
              <a href={booking.rescheduleUrl} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">
                Verschiebungslink
              </a>
            )}
            {booking.bookingLink && <span className="text-ink-700/50">Erkannter Link: {booking.bookingLink.name}</span>}
            {!booking.cancelUrl && !booking.rescheduleUrl && <span className="text-ink-700/40">Keine Calendly-Links hinterlegt.</span>}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <AppointmentActions
          bookingId={booking.id}
          status={booking.status}
          hasClient={Boolean(booking.clientId)}
          hasProduct={Boolean(booking.productId)}
          hasEntitlement={Boolean(booking.entitlementId)}
          complimentary={booking.complimentary}
          clients={clients}
          products={products}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts
          clientEntitlements={clientEntitlements.map((e: any) => ({
            id: e.id,
            label: e.label,
            productName: e.product?.name ?? null,
            unlimited: e.unlimited,
            available: computeStatus(e, e.ledgerEntries).available,
          }))}
        />
      </div>
    </main>
  );
}
