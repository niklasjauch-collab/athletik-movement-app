import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { requireAdmin, AdminAuthRequiredError } from "@/lib/adminAuth";

// CoachAdmin briefing §6 — "Admin muss zukünftig weitere Segmente selbst
// erstellen können." GET lists all segments (used by the customer detail
// page's assignment checkboxes and the /admin/customers/manage page);
// POST creates a new custom one (isSystemDefault stays false — only
// seed.ts's 6 standard segments get that flag).
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
  const segments = await prisma.customerSegment.findMany({
    where: { providerId: provider.id },
    orderBy: [{ isSystemDefault: "desc" }, { name: "asc" }],
  });
  return Response.json({ segments });
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

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
  const { name, description, colorHex } = (body ?? {}) as Record<string, unknown>;
  if (typeof name !== "string" || !name.trim()) {
    return Response.json({ error: "Name fehlt." }, { status: 400 });
  }

  const provider = await getActiveProvider();
  const baseKey = slugify(name) || "segment";
  let key = baseKey;
  let n = 1;
  // Avoid the [providerId, key] unique clash if a coach creates two
  // segments whose names slugify to the same thing (e.g. "VIP" / "vip!").
  while (await prisma.customerSegment.findFirst({ where: { providerId: provider.id, key } })) {
    n += 1;
    key = `${baseKey}-${n}`;
  }

  const segment = await prisma.customerSegment.create({
    data: {
      providerId: provider.id,
      key,
      name: name.trim(),
      description: typeof description === "string" ? description.trim() || null : null,
      colorHex: typeof colorHex === "string" ? colorHex : null,
      isSystemDefault: false,
    },
  });

  return Response.json({ ok: true, segment });
}
