import { consumePasswordResetToken } from "@/lib/auth";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const { token, password } = (body ?? {}) as Record<string, unknown>;
  if (typeof token !== "string" || !token) {
    return Response.json({ error: "Link ist ungültig." }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 8) {
    return Response.json({ error: "Das Passwort muss mindestens 8 Zeichen lang sein." }, { status: 400 });
  }

  try {
    const result = await consumePasswordResetToken(token, password);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[auth/reset-password] failed", err);
    return Response.json({ error: "Zurücksetzen fehlgeschlagen. Bitte später erneut versuchen." }, { status: 500 });
  }
}
