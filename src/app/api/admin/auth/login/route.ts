import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { verifyPassword, normalizeEmail, createAdminSession } from "@/lib/adminAuth";

// Mirror of /api/auth/login for AdminUser (COACH_ADMIN) — same generic
// error regardless of which check failed, same reasoning (don't let a
// caller enumerate which emails have accounts).
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
    const admin = await prisma.adminUser.findUnique({
      where: { providerId_email: { providerId: provider.id, email: normalizeEmail(email) } },
    });

    if (!admin || !admin.passwordHash) {
      return Response.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    const valid = await verifyPassword(password, admin.passwordHash);
    if (!valid) {
      return Response.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    await createAdminSession(admin.id);
    return Response.json({ ok: true, admin: { id: admin.id, name: admin.name, email: admin.email } });
  } catch (err) {
    console.error("[admin/auth/login] failed", err);
    return Response.json({ error: "Login fehlgeschlagen. Bitte später erneut versuchen." }, { status: 500 });
  }
}
