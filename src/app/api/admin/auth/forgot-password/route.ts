import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { createAdminPasswordResetToken, normalizeEmail } from "@/lib/adminAuth";
import { sendEmail } from "@/lib/email";
import { getBranding } from "@/lib/branding";

// Mirror of /api/auth/forgot-password for AdminUser. This is also how
// the FIRST coach account gets a real password: seed.ts creates the
// AdminUser row with passwordHash null (see seed.ts's ADMIN_EMAIL
// section), and this flow is used to set it for the first time — same
// mechanism as "forgot password", not a separate "first login" flow.
const GENERIC_MESSAGE = "Falls ein Konto mit dieser E-Mail-Adresse existiert, wurde eine E-Mail zum Zurücksetzen des Passworts verschickt.";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const { email } = (body ?? {}) as Record<string, unknown>;
  if (typeof email !== "string" || !email) {
    return Response.json({ error: "E-Mail-Adresse fehlt." }, { status: 400 });
  }

  try {
    const provider = await getActiveProvider();
    const admin = await prisma.adminUser.findUnique({
      where: { providerId_email: { providerId: provider.id, email: normalizeEmail(email) } },
    });

    // devResetUrl / the console log inside sendEmail (see src/lib/email.ts)
    // is how to get this link without a real mail provider configured —
    // check the Railway deploy logs for "[email:dev]" if RESEND_API_KEY
    // isn't set.
    let devResetUrl: string | undefined;

    if (admin) {
      const { token } = await createAdminPasswordResetToken(admin.id);
      const resetUrl = new URL(`/admin/reset-password?token=${token}`, request.url).toString();
      const branding = getBranding();

      await sendEmail({
        to: admin.email,
        subject: `${branding.appName} Coach-Bereich: Passwort zurücksetzen`,
        text: `Hallo ${admin.name},\n\nüber diesen Link kannst du dein Coach-Passwort setzen/zurücksetzen (gültig 1 Stunde):\n${resetUrl}\n\nFalls du das nicht angefragt hast, kannst du diese E-Mail ignorieren.`,
      });

      if (!process.env.RESEND_API_KEY) {
        devResetUrl = resetUrl;
      }
    }

    return Response.json({ ok: true, message: GENERIC_MESSAGE, devResetUrl });
  } catch (err) {
    console.error("[admin/auth/forgot-password] failed", err);
    return Response.json({ error: "Anfrage fehlgeschlagen. Bitte später erneut versuchen." }, { status: 500 });
  }
}
