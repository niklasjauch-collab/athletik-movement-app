import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { verifyPassword, createSession, normalizeEmail } from "@/lib/auth";

// Deliberately returns the SAME generic error whether the email doesn't
// exist, the account has no password set yet (passwordHash null — e.g. a
// coach-created client who hasn't self-registered), or the password is
// wrong. Distinguishing these to the client would let an attacker enumerate
// registered emails.
const GENERIC_ERROR = "E-Mail oder Passwort ist falsch.";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const { email, password } = (body ?? {}) as Record<string, unknown>;
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return Response.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  try {
    const provider = await getActiveProvider();
    const client = await prisma.client.findUnique({
      where: { providerId_email: { providerId: provider.id, email: normalizeEmail(email) } },
    });

    if (!client || !client.passwordHash) {
      return Response.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    const valid = await verifyPassword(password, client.passwordHash);
    if (!valid) {
      return Response.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    await createSession(client.id);
    return Response.json({ ok: true, client: { id: client.id, firstName: client.firstName, email: client.email } });
  } catch (err) {
    console.error("[auth/login] failed", err);
    return Response.json({ error: "Login fehlgeschlagen. Bitte später erneut versuchen." }, { status: 500 });
  }
}
