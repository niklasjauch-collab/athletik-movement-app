import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { hashPassword, createSession, normalizeEmail } from "@/lib/auth";

// Client self-registration: Vorname, Nachname, E-Mail (= username) +
// Passwort in one request. The /register page presents this as a 2-step
// wizard (Angaben, then Passwort) per the product brief, but submits both
// steps together here rather than creating a passwordless Client row
// after step 1 — avoids ever having an account that exists but can't log
// in because the user closed the tab between steps.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const { firstName, lastName, email, password } = (body ?? {}) as Record<string, unknown>;

  if (typeof firstName !== "string" || !firstName.trim()) {
    return Response.json({ error: "Vorname fehlt." }, { status: 400 });
  }
  if (typeof lastName !== "string" || !lastName.trim()) {
    return Response.json({ error: "Nachname fehlt." }, { status: 400 });
  }
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Bitte eine gültige E-Mail-Adresse angeben." }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 8) {
    return Response.json({ error: "Das Passwort muss mindestens 8 Zeichen lang sein." }, { status: 400 });
  }

  const normalizedEmail = normalizeEmail(email);

  try {
    const provider = await getActiveProvider();

    const existing = await prisma.client.findUnique({
      where: { providerId_email: { providerId: provider.id, email: normalizedEmail } },
    });
    if (existing) {
      return Response.json(
        { error: "Für diese E-Mail-Adresse existiert bereits ein Konto. Bitte einloggen oder Passwort zurücksetzen." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const client = await prisma.client.create({
      data: {
        providerId: provider.id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        passwordHash,
      },
    });

    // Auto-login right after registration — no separate login step needed.
    await createSession(client.id);

    return Response.json({ ok: true, client: { id: client.id, firstName: client.firstName, email: client.email } });
  } catch (err) {
    console.error("[auth/register] failed", err);
    return Response.json({ error: "Registrierung fehlgeschlagen. Bitte später erneut versuchen." }, { status: 500 });
  }
}
