import Link from "next/link";
import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// CoachAdmin briefing §61 GLOBAL SEARCH — "Niklas gibt ein „Susanna und
// bekommt: Kunde / Termine / Pakete / Zahlungen / Scans / Pläne. Nicht
// durch fünf Bereiche klicken müssen." Implemented as a search-results
// page (submitted from the search box in AdminNav) rather than a live-
// typing dropdown — consistent with the rest of the admin area's server-
// rendered, no-extra-client-framework pattern (same pragmatic choice as
// the Plan Builder being one screen instead of a JS wizard, §33's own
// simplification in P5).
export default async function AdminSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const provider = await getActiveProvider();

  if (!q) {
    return (
      <main className="flex-1 px-6 py-10 max-w-3xl mx-auto">
        <h1 className="font-serif text-3xl font-bold text-ink-900">Suche</h1>
        <p className="mt-2 text-sm text-ink-700/60">Bitte einen Suchbegriff eingeben.</p>
      </main>
    );
  }

  const ci = { contains: q, mode: "insensitive" as const };

  const [clients, bookings, entitlements, payments, scans, plans] = await Promise.all([
    prisma.client.findMany({
      where: { providerId: provider.id, OR: [{ firstName: ci }, { lastName: ci }, { email: ci }, { customerNumber: ci }] },
      take: 8,
    }),
    prisma.booking.findMany({
      where: {
        OR: [{ client: { providerId: provider.id } }, { clientId: null }],
        AND: [{ OR: [{ inviteeName: ci }, { calendlyEventName: ci }, { client: { firstName: ci } }, { client: { lastName: ci } }] }],
      },
      include: { client: { select: { id: true, firstName: true, lastName: true } } },
      take: 8,
      orderBy: { startTime: "desc" },
    }),
    prisma.packageEntitlement.findMany({
      where: { client: { providerId: provider.id }, OR: [{ label: ci }, { client: { firstName: ci } }, { client: { lastName: ci } }] },
      include: { client: { select: { id: true, firstName: true, lastName: true } } },
      take: 8,
    }),
    prisma.payment.findMany({
      where: { providerId: provider.id, OR: [{ note: ci }, { client: { firstName: ci } }, { client: { lastName: ci } }, { product: { name: ci } }] },
      include: { client: { select: { id: true, firstName: true, lastName: true } } },
      take: 8,
    }),
    prisma.movementScan.findMany({
      where: { providerId: provider.id, client: { OR: [{ firstName: ci }, { lastName: ci }] } },
      include: { client: { select: { id: true, firstName: true, lastName: true } } },
      take: 8,
      orderBy: { uploadedAt: "desc" },
    }),
    prisma.trainingPlan.findMany({
      where: { providerId: provider.id, OR: [{ title: ci }, { client: { firstName: ci } }, { client: { lastName: ci } }] },
      include: { client: { select: { id: true, firstName: true, lastName: true } } },
      take: 8,
    }),
  ]);

  const totalHits = clients.length + bookings.length + entitlements.length + payments.length + scans.length + plans.length;

  return (
    <main className="flex-1 px-6 py-10 max-w-3xl mx-auto">
      <h1 className="font-serif text-3xl font-bold text-ink-900">Suche: „{q}&quot;</h1>
      <p className="mt-1 text-sm text-ink-700/60">{totalHits} Treffer über 6 Bereiche.</p>

      {totalHits === 0 && <p className="mt-8 text-sm text-ink-700/50">Keine Treffer. Versuch einen anderen Suchbegriff.</p>}

      {clients.length > 0 && (
        <ResultSection title="Kunde">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
          {clients.map((c: any) => (
            <ResultRow key={c.id} href={`/admin/customers/${c.id}`}>
              {c.firstName} {c.lastName} <span className="text-ink-700/50">· {c.email}</span>
            </ResultRow>
          ))}
        </ResultSection>
      )}

      {bookings.length > 0 && (
        <ResultSection title="Termine">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
          {bookings.map((b: any) => (
            <ResultRow key={b.id} href={`/admin/appointments/${b.id}`}>
              {b.client ? `${b.client.firstName} ${b.client.lastName}` : (b.inviteeName ?? "Unbekannt")}{" "}
              <span className="text-ink-700/50">
                · {b.calendlyEventName ?? "—"} · {new Date(b.startTime).toLocaleDateString("de-DE")}
              </span>
            </ResultRow>
          ))}
        </ResultSection>
      )}

      {entitlements.length > 0 && (
        <ResultSection title="Pakete">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
          {entitlements.map((e: any) => (
            <ResultRow key={e.id} href={e.client ? `/admin/customers/${e.client.id}?tab=kontingente` : "/admin/customers"}>
              {e.label} <span className="text-ink-700/50">· {e.client ? `${e.client.firstName} ${e.client.lastName}` : "—"}</span>
            </ResultRow>
          ))}
        </ResultSection>
      )}

      {payments.length > 0 && (
        <ResultSection title="Zahlungen">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
          {payments.map((p: any) => (
            <ResultRow key={p.id} href={`/admin/payments/${p.id}`}>
              {(p.amountCents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}{" "}
              <span className="text-ink-700/50">
                · {p.client ? `${p.client.firstName} ${p.client.lastName}` : "—"} · {new Date(p.paidAt).toLocaleDateString("de-DE")}
              </span>
            </ResultRow>
          ))}
        </ResultSection>
      )}

      {scans.length > 0 && (
        <ResultSection title="Scans">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
          {scans.map((s: any) => (
            <ResultRow key={s.id} href={`/admin/scans/${s.id}`}>
              {s.client ? `${s.client.firstName} ${s.client.lastName}` : "—"}{" "}
              <span className="text-ink-700/50">· {new Date(s.uploadedAt).toLocaleDateString("de-DE")}</span>
            </ResultRow>
          ))}
        </ResultSection>
      )}

      {plans.length > 0 && (
        <ResultSection title="Pläne">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
          {plans.map((p: any) => (
            <ResultRow key={p.id} href={`/admin/plans/${p.id}`}>
              {p.title} <span className="text-ink-700/50">· {p.client ? `${p.client.firstName} ${p.client.lastName}` : "Template"}</span>
            </ResultRow>
          ))}
        </ResultSection>
      )}
    </main>
  );
}

function ResultSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-brand-600">{title}</h2>
      <div className="mt-2 divide-y divide-ink-900/5 rounded-xl border border-ink-900/10">{children}</div>
    </section>
  );
}

function ResultRow({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="block px-4 py-2.5 text-sm hover:bg-ink-900/[0.03]">
      {children}
    </Link>
  );
}
