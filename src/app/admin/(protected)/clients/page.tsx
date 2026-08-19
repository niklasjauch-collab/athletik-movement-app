import Link from "next/link";
import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";

// Hits the database directly and doesn't itself call cookies()/headers(),
// so Next's automatic dynamic-API detection won't defer it — without this,
// `next build` tries to prerender it statically, which fails hard (not a
// graceful dynamic fallback) if the database isn't reachable from the
// build environment (as on Railway, where the build container can't
// reach the private-network Postgres instance).
export const dynamic = "force-dynamic";

// Coach-facing client list. Clients get here by self-registering via
// /register (see the product brief) — there is deliberately no
// "Kunde anlegen" form here, since the coach doesn't create accounts on a
// client's behalf, they just work with clients who've already signed up.
export default async function ClientsPage() {
  const provider = await getActiveProvider();
  const clients = await prisma.client.findMany({
    where: { providerId: provider.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { movementScans: true, correctivePlans: true } },
    },
  });

  return (
    <main className="flex-1 max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-extrabold">Kunden</h1>
      <p className="mt-2 text-slate-500">
        Kunden registrieren sich selbst über die Registrierung. Wähle einen Kunden aus, um einen
        SmartMotionScan hochzuladen — der Corrective-Exercise-Plan wird danach automatisch erstellt.
      </p>

      {clients.length === 0 ? (
        <p className="mt-8 text-sm text-slate-400">Noch keine registrierten Kunden.</p>
      ) : (
        <ul className="mt-8 flex flex-col gap-2">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts */}
          {clients.map((c: any) => (
            <li key={c.id}>
              <Link
                href={`/admin/clients/${c.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 hover:border-brand-300"
              >
                <div>
                  <p className="font-medium text-ink-900">
                    {c.firstName} {c.lastName}
                  </p>
                  <p className="text-xs text-slate-400">{c.email}</p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>{c._count.movementScans} Scan(s)</p>
                  <p>{c._count.correctivePlans} Plan(e)</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
