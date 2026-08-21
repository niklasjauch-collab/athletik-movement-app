import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { requireAdmin, AdminAuthRequiredError } from "@/lib/adminAuth";
import { refundPayment } from "@/lib/payments";

// CoachAdmin briefing §31 Refunds — amount, keepAccess (Zugang behalten vs.
// entfernen), reason are all required (same "keine stillen Änderungen"
// discipline as §14's manual Kontingentkorrektur).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof AdminAuthRequiredError) {
      return Response.json({ error: "Nicht als Coach angemeldet." }, { status: 401 });
    }
    throw err;
  }

  const { id: paymentId } = await params;
  const provider = await getActiveProvider();
  const payment = await prisma.payment.findFirst({ where: { id: paymentId, providerId: provider.id } });
  if (!payment) {
    return Response.json({ error: "Zahlung nicht gefunden." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const amountCents = typeof b.amountCents === "number" && Number.isFinite(b.amountCents) ? Math.round(b.amountCents) : NaN;
  const keepAccess = b.keepAccess === true;
  const reason = typeof b.reason === "string" ? b.reason.trim() : "";

  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return Response.json({ error: "Betrag muss größer als 0 sein." }, { status: 400 });
  }
  if (!reason) {
    return Response.json({ error: "Grund ist erforderlich." }, { status: 400 });
  }

  try {
    const refund = await refundPayment({
      paymentId: payment.id,
      amountCents,
      keepAccess,
      reason,
      adminId: admin.id,
    });
    return Response.json({ refund });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refund fehlgeschlagen.";
    return Response.json({ error: message }, { status: 400 });
  }
}
