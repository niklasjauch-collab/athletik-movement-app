import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { requireAdmin, AdminAuthRequiredError } from "@/lib/adminAuth";

// CoachAdmin briefing §24 — the commercial product catalog. GET lists
// everything (admin sees inactive/hidden products too, unlike the
// customer-facing resolution helpers in src/lib/commerceResolution.ts);
// POST creates a new product. Price overrides/visibility rules/booking
// links are managed separately under /api/admin/products/[id]/*.
export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AdminAuthRequiredError) {
      return Response.json({ error: "Nicht als Coach angemeldet." }, { status: 401 });
    }
    throw err;
  }
  const provider = await getActiveProvider();
  const products = await prisma.product.findMany({
    where: { providerId: provider.id },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      _count: { select: { prices: true, accessRules: true, bookingLinks: true } },
    },
  });
  return Response.json({ products });
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const VALID_TYPES = ["COACHING_SESSION", "COACHING_PACKAGE", "SMARTMOTION_SCAN", "DIGITAL_TRAINING_PLAN", "COMPLIMENTARY"];

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AdminAuthRequiredError) {
      return Response.json({ error: "Nicht als Coach angemeldet." }, { status: 401 });
    }
    throw err;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  const { name, type, priceCents, credits, description } = (body ?? {}) as Record<string, unknown>;
  if (typeof name !== "string" || !name.trim()) {
    return Response.json({ error: "Name fehlt." }, { status: 400 });
  }
  if (typeof type !== "string" || !VALID_TYPES.includes(type)) {
    return Response.json({ error: "Ungültiger Produkttyp." }, { status: 400 });
  }
  if (typeof priceCents !== "number" || !Number.isFinite(priceCents) || priceCents < 0) {
    return Response.json({ error: "Ungültiger Preis." }, { status: 400 });
  }

  const provider = await getActiveProvider();
  const baseKey = slugify(name) || "produkt";
  let key = baseKey;
  let n = 1;
  while (await prisma.product.findFirst({ where: { providerId: provider.id, key } })) {
    n += 1;
    key = `${baseKey}-${n}`;
  }

  const product = await prisma.product.create({
    data: {
      providerId: provider.id,
      key,
      name: name.trim(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SANDBOX-ONLY, see src/lib/db.ts
      type: type as any,
      priceCents: Math.round(priceCents),
      credits: typeof credits === "number" && Number.isFinite(credits) ? Math.round(credits) : null,
      description: typeof description === "string" ? description.trim() || null : null,
    },
  });

  return Response.json({ ok: true, product });
}
