import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { createPasswordResetToken, normalizeEmail } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { getBranding } from "@/lib/branding";
import { absoluteUrl } from "@/lib/baseUrl";

// Always responds with the same generic success message regardless of
// whether the email is actually registered — otherwise this endpoint
// would let an attacker check which emails have accounts.
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
    const client = await prisma.client.findUnique({
      where: { providerId_email: { providerId: provider.id, email: normalizeEmail(email) } },
    });

    // devResetUrl is only ever included in the response when RESEND_API_KEY
    // is NOT configured (see sendEmail) — i.e. local/sandbox development,
    // never in a real deployment with email actually wired up. The
    // /forgot-password page shows it inline in that case so the flow can
    // be tested end-to-end without a mail provider.
    let devResetUrl: string | undefined;

    if (client) {
      const { token } = await createPasswordResetToken(client.id);
      const resetUrl = absoluteUrl(request, `/reset-password?token=${token}`);
      const branding = getBranding();

      await sendEmail({
        to: client.email,
        subject: `${branding.appName}: Passwort zurücksetzen`,
        text: `Hallo ${client.firstName},\n\nüber diesen Link kannst du dein Passwort zurücksetzen (gültig 1 Stunde):\n${resetUrl}\n\nFalls du das nicht angefragt hast, kannst du diese E-Mail ignorieren.`,
      });

      if (!process.env.RESEND_API_KEY) {
        devResetUrl = resetUrl;
      }
    }
    // If no client matched, we silently do nothing further — same
    // response either way, see GENERIC_MESSAGE above.

    return Response.json({ ok: true, message: GENERIC_MESSAGE, devResetUrl });
  } catch (err) {
    console.error("[auth/forgot-password] failed", err);
    return Response.json({ error: "Anfrage fehlgeschlagen. Bitte später erneut versuchen." }, { status: 500 });
  }
}
