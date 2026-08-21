import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { requireAdmin, AdminAuthRequiredError } from "@/lib/adminAuth";

// §62 QUICK ACTIONS "+ Kunde" — the one Quick Action with no existing
// equivalent flow to link to (every other action already has a natural
// home: Zahlung/Kontingent/Scan on the customer detail page, Plan on
// /admin/plans, Termin only ever via Calendly per P4's deliberate design).
// A coach adding a customer manually (walk-in, phone booking, migration)
// needs SOME way in — this is the minimal version: no password is set
// here (passwordHash stays null, same as any client who hasn't completed
// self-service registration yet — see the doc comment on Client.
// passwordHash), so the customer still logs in themselves via the normal
// registration/password-reset flow once they have an account, exactly
// like a client Niklas adds today by hand in the database would.
export async function POST(request: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof AdminAuthRequiredError) {
      return Response.json({ error: "Nicht als Coach angemeldet." }, { status: 401 });
    }
    throw err;
  }
  void admin;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const firstName = typeof b.firstName === "string" ? b.firstName.trim() : "";
  const lastName = typeof b.lastName === "string" ? b.lastName.trim() : "";
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const phone = typeof b.phone === "string" && b.phone.trim() ? b.phone.trim() : null;

  if (!firstName || !lastName || !email) {
    return Response.json({ error: "Vorname, Nachname und E-Mail sind erforderlich." }, { status: 400 });
  }
  if (!email.includes("@")) {
    return Response.json({ error: "Ungültige E-Mail-Adresse." }, { status: 400 });
  }

  const provider = await getActiveProvider();

  const existing = await prisma.client.findFirst({ where: { providerId: provider.id, email } });
  if (existing) {
    return Response.json({ error: "Ein Kunde mit dieser E-Mail existiert bereits.", clientId: existing.id }, { status: 409 });
  }

  // Same customerNumber format/sequencing as seed.ts's backfill loop (P1,
  // Runde 5 Teil 3) — "AM-0001" style, next free sequential number.
  const last = await prisma.client.findFirst({
    where: { providerId: provider.id, customerNumber: { not: null } },
    orderBy: { customerNumber: "desc" },
    select: { customerNumber: true },
  });
  const lastN = last?.customerNumber ? parseInt(last.customerNumber.replace(/\D/g, ""), 10) || 0 : 0;
  const customerNumber = `AM-${String(lastN + 1).padStart(4, "0")}`;

  const client = await prisma.client.create({
    data: { providerId: provider.id, firstName, lastName, email, phone, customerNumber },
  });

  return Response.json({ id: client.id, customerNumber: client.customerNumber });
}
