import Link from "next/link";
import CreateCustomerForm from "./CreateCustomerForm";

export const dynamic = "force-dynamic";

// §62 QUICK ACTIONS "+ Kunde" — see the doc comment on
// /api/admin/customers/route.ts for why this is the one Quick Action that
// needed genuinely new code (every other action already had an existing
// home to link to).
export default function NewCustomerPage() {
  return (
    <main className="flex-1 px-6 py-10 max-w-3xl mx-auto">
      <p className="text-sm text-ink-700/50">
        <Link href="/admin/customers" className="hover:underline">
          ← Kunden
        </Link>
      </p>
      <h1 className="mt-2 font-serif text-3xl font-bold text-ink-900">Kunde manuell anlegen</h1>
      <p className="mt-1 text-sm text-ink-700/70">
        Für Fälle ohne Selbst-Registrierung (Walk-in, Telefonbuchung, Migration).
      </p>
      <CreateCustomerForm />
    </main>
  );
}
