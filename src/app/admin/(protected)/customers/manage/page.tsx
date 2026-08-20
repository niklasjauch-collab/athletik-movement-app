import Link from "next/link";
import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import SegmentsManager from "./SegmentsManager";
import LegacyProgramsManager from "./LegacyProgramsManager";

export const dynamic = "force-dynamic";

// Nested under /admin/customers rather than given its own top-level nav
// item — CoachAdmin briefing §1's "nicht für jede Kleinigkeit einen
// eigenen Menüpunkt" applies here (segments/legacy programs are
// customer-management configuration, not a separate feature area).
export default async function CustomerManagePage() {
  const provider = await getActiveProvider();
  const [segments, legacyPrograms] = await Promise.all([
    prisma.customerSegment.findMany({
      where: { providerId: provider.id },
      orderBy: [{ isSystemDefault: "desc" }, { name: "asc" }],
    }),
    prisma.legacyProgram.findMany({ where: { providerId: provider.id }, orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <main className="flex-1 px-6 py-10 max-w-3xl mx-auto">
      <p className="text-sm text-ink-700/50">
        <Link href="/admin/customers" className="hover:underline">
          ← Kunden
        </Link>
      </p>
      <h1 className="mt-2 font-serif text-3xl font-bold text-ink-900">Segmente &amp; Legacy-Programme</h1>
      <p className="mt-1 text-sm text-ink-700/70">
        Segmente und Legacy-Programme sind bewusst kein Code, sondern verwaltbare Daten — neue Gruppen entstehen hier,
        nicht durch neue Sonderfälle im Code.
      </p>

      <section className="mt-8">
        <h2 className="font-semibold text-lg text-ink-900">Segmente</h2>
        <div className="mt-3">
          <SegmentsManager segments={segments} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-semibold text-lg text-ink-900">Legacy-Programme</h2>
        <div className="mt-3">
          <LegacyProgramsManager legacyPrograms={legacyPrograms} />
        </div>
      </section>
    </main>
  );
}
