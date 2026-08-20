import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/tenant";
import { requireAdmin, AdminAuthRequiredError } from "@/lib/adminAuth";

// CoachAdmin briefing §10 — named legacy programs (e.g. "Legacy 2024"),
// assignable to individual customers so they keep grandfathered
// conditions. See LegacyProgram's schema.prisma comment for why the
// price/link/package fields are free-text notes for now.
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
  const legacyPrograms = await prisma.legacyProgram.findMany({
    where: { providerId: provider.id },
    orderBy: { createdAt: "asc" },
  });
  return Response.json({ legacyPrograms });
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
  const { name, oldPriceNote, oldBookingLinkUrl, oldPackageSizeNote, conditionsNote, hideNewProducts } =
    (body ?? {}) as Record<string, unknown>;
  if (typeof name !== "string" || !name.trim()) {
    return Response.json({ error: "Name fehlt." }, { status: 400 });
  }

  const provider = await getActiveProvider();
  const baseKey = slugify(name) || "legacy";
  let key = baseKey;
  let n = 1;
  while (await prisma.legacyProgram.findFirst({ where: { providerId: provider.id, key } })) {
    n += 1;
    key = `${baseKey}-${n}`;
  }

  const legacyProgram = await prisma.legacyProgram.create({
    data: {
      providerId: provider.id,
      key,
      name: name.trim(),
      oldPriceNote: typeof oldPriceNote === "string" ? oldPriceNote.trim() || null : null,
      oldBookingLinkUrl: typeof oldBookingLinkUrl === "string" ? oldBookingLinkUrl.trim() || null : null,
      oldPackageSizeNote: typeof oldPackageSizeNote === "string" ? oldPackageSizeNote.trim() || null : null,
      conditionsNote: typeof conditionsNote === "string" ? conditionsNote.trim() || null : null,
      hideNewProducts: hideNewProducts === true,
    },
  });

  return Response.json({ ok: true, legacyProgram });
}
