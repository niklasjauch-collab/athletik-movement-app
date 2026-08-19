// Seed script for the exercise library: 71 exercises migrated 1:1 from
// the legacy BodyControl app (admin.bodycontrol.io/de/exercises/list),
// plus a generic set of NASM-derived Corrective Exercise templates.
//
// Usage (once DATABASE_URL is set and `npx prisma migrate dev` has run):
//   npx tsx prisma/seed.ts
// or wire it up as the `prisma.seed` entry in package.json and run
// `npx prisma db seed`.
//
// Data sources:
//   - prisma/seed-data/exercises.json (71 exercises), generated from a
//     field-by-field export of the legacy app's exercise edit forms, and
//     best-effort auto-tagged with correctivePhase/targetMuscles by
//     prisma/seed-data/tag-exercises.py.
//   - prisma/seed-data/corrective-exercises.json, a curated generic set
//     hand-authored from the NASM CES textbook's Sample Corrective
//     Exercise Program tables by
//     prisma/seed-data/generate-corrective-exercises.py.
//   - prisma/seed-data/draft-exercises.json, the SmartMotionApproach
//     45-exercise production pipeline (see claude/SmartMotionApproach_
//     Produktionsplan.md in the project). Seeded with isPublished:false
//     — fully specified but hidden until a real video is filmed. See
//     README.md "SmartMotionApproach production pipeline".
// See README.md "Exercise library migration" and "Corrective Exercise
// plans" sections for the full story, including why the video files
// themselves are NOT included here.
//
// Also seeds the 22 SmartMotion sellable programs (see README
// "SmartMotion-Programme" and SmartMotion_App_22_Programme_Claude_
// MasterSpec.md at the repo root) — data sources:
//   - prisma/seed-data/smartmotion-exercise-registry.json,
//     smartmotion-code-to-name.json, smartmotion-stub-exercises.json:
//     the spec's 116-entry "verbindliche" exercise registry (E001-E116),
//     matched against the exercises above by name, plus placeholder
//     Exercise rows (isPublished:false) for the ones that don't exist
//     yet — see scripts/match_smartmotion_exercises.py and
//     scripts/generate_smartmotion_seed_data.py, which produced these
//     from the spec (not hand-authored).
//   - prisma/seed-data/smartmotion-products-catalog.json: all 22
//     products' catalog/marketing fields (title, hook, description,
//     price, ...), parsed from the spec by
//     scripts/parse_smartmotion_spec.py.
//   - prisma/seed-data/smartmotion-programs.json: full 12-week
//     block/session/exercise structure for the 10 LAUNCH products only
//     (P01-P06, P08, P09, P15, P18) — the other 12 exist as Product rows
//     (isPublished:false) with no ProgramBlock data yet; see README for
//     why this round stopped there.

import { PrismaClient, CorrectivePhase, BibCategory, ExerciseLevel, ProductCategory } from "@prisma/client";
import exercisesData from "./seed-data/exercises.json";
import correctiveExercisesData from "./seed-data/corrective-exercises.json";
import draftExercisesData from "./seed-data/draft-exercises.json";
import smartMotionCodeToNameData from "./seed-data/smartmotion-code-to-name.json";
import smartMotionStubExercisesData from "./seed-data/smartmotion-stub-exercises.json";
import smartMotionProductsCatalogData from "./seed-data/smartmotion-products-catalog.json";
import smartMotionProgramsData from "./seed-data/smartmotion-programs.json";

const prisma = new PrismaClient();

type SmartMotionCodeMap = Record<string, { name: string; source: string }>;

type SmartMotionStubExercise = {
  smartMotionCode: string;
  name: string;
  correctivePhase: string;
  unit: string;
  sets: number[];
  pauseSeconds: number;
  intensity: string;
  muscleGroups: string[];
  equipment: string[];
  targetMuscles: string[];
  taggingSource: string | null;
  isPublished: boolean;
  notes: string;
};

type SmartMotionProductCatalogEntry = {
  id: string; // the spec's own ID, e.g. "P01"
  title: string;
  category: "HALTUNG" | "BESCHWERDEN_RETURN_TO_MOVEMENT";
  slug: string;
  launch: boolean;
  contentStatus: string;
  priceRaw: string;
  hook: string;
  description: string;
  forYou: string;
  cta: string;
  frequency: string;
  testRetestProtocol: string;
  specialLogicNote: string | null;
};

type SmartMotionExerciseRef = { code: string; name: string; raw_status: string };
// phase ("INHIBIT"|"LENGTHEN"|"ACTIVATE"|"INTEGRATE") -> ordered refs
type SmartMotionSession = Record<string, SmartMotionExerciseRef[]>;
type SmartMotionBlock = {
  weekStart: number;
  weekEnd: number;
  progressionRule: string | null;
  sessions: Record<string, SmartMotionSession>; // "A"|"B" -> session
};
type SmartMotionProgram = { id: string; blocks: SmartMotionBlock[]; abschluss: string | null };

/** Parses the spec's free-text "Preis" field (e.g. "79 € / 90 Tage (69 €
 * optionaler Launch-Test)") into a primary priceCents value (from the
 * FIRST € amount) plus the full raw text as priceNote -- but only when
 * that raw text carries more than the flat "NN € / 90 Tage" case, so
 * priceNote stays null for the common case instead of duplicating
 * priceCents as text on every product. */
function parsePriceEur(raw: string): { cents: number; note: string | null } {
  const match = raw.match(/(\d+)\s*€/);
  const cents = match ? parseInt(match[1], 10) * 100 : 0;
  const isFlatStandardCase = /^\d+\s*€\s*\/\s*90\s*Tage$/.test(raw.trim());
  return { cents, note: isFlatStandardCase ? null : raw };
}

// Superset type covering every field across the three seed-data shapes —
// exercises.json/corrective-exercises.json only populate the "base"
// fields, draft-exercises.json also populates the SmartMotionApproach
// production-spec fields. All extended fields are optional so each file
// can be spread into one array without per-file branching below.
type SeedExerciseInput = {
  legacyId: string | null;
  name: string;
  nameEn?: string | null;
  description: string | null;
  language: string;
  muscleGroups: string[];
  equipment: string[];
  unit: string;
  pauseSeconds: number;
  sets: number[];
  intensity: string;
  notes?: string | null;
  videoMalePath?: string | null;
  videoFemalePath?: string | null;
  correctivePhase?: string | null;
  targetMuscles?: string[];
  taggingSource?: string | null;
  isPublished?: boolean;
  bibCategory?: string | null;
  level?: string | null;
  productionRound?: number | null;
  relevantSigns?: string[];
  relevantSignClusters?: string[];
  relevantSubsystems?: string[];
  rationale?: string | null;
  startPosition?: string | null;
  execution?: string | null;
  coachingCues?: string[];
  commonMistakes?: string[];
  dosageNote?: string | null;
  regressionNote?: string | null;
  progressionNote?: string | null;
  contraindicationNote?: string | null;
  similarExistingName?: string | null; // resolved to similarExistingExerciseId in a second pass below
  similarExistingDifference?: string | null;
};

// All three files share the same base shape; draft-exercises.json adds
// the extra SmartMotionApproach production-spec fields (bibCategory,
// level, coachingCues, etc. — see schema.prisma) and an isPublished:false
// default. legacyId is null for corrective-exercises.json and
// draft-exercises.json (BodyControl-migrated exercises.json has real
// Firestore IDs). Concatenating means one loop seeds all three — see
// README "Exercise library migration" + "Corrective Exercise plans" +
// "SmartMotionApproach production pipeline" sections for where each
// comes from.
const allExercises = [
  ...(exercisesData as SeedExerciseInput[]),
  ...(correctiveExercisesData as SeedExerciseInput[]),
  ...(draftExercisesData as SeedExerciseInput[]),
];

async function main() {
  // Athletik Movement is the platform's first beta tenant (see
  // src/lib/branding.ts) — this is the Provider row the app's static
  // branding config will eventually be looked up from once a second
  // tenant exists (see the TODO there). Adjust slug/appName here if you
  // rename the provider, or look it up instead of creating it once a
  // real onboarding flow exists.
  const provider = await prisma.provider.upsert({
    where: { slug: "athletik-movement" },
    update: {},
    create: {
      slug: "athletik-movement",
      name: "Athletik Movement",
      appName: "Athletik Movement",
      logoUrl: "/brand/athletik-movement-logo.png",
      primaryColor: "#4f7a12",
    },
  });

  // ============================================================
  // First COACH_ADMIN account (P0 role split, see schema.prisma's
  // AdminUser doc comment). passwordHash is deliberately left null —
  // the real password gets set via /admin/forgot-password's "Passwort
  // vergessen" flow, same mechanism as any later reset, so this script
  // never has to invent, transmit, or store a real password.
  // ============================================================
  // Inline trim+lowercase rather than importing src/lib/auth.ts's
  // normalizeEmail — that file imports next/headers, which isn't safe to
  // pull into this standalone `tsx prisma/seed.ts` script (run outside
  // Next's request context).
  const adminEmail = (process.env.ADMIN_EMAIL || "niklasjauch@gmail.com").trim().toLowerCase();
  const adminName = process.env.ADMIN_NAME || "Niklas Jauch";
  const adminUser = await prisma.adminUser.upsert({
    where: { providerId_email: { providerId: provider.id, email: adminEmail } },
    update: {},
    create: { providerId: provider.id, email: adminEmail, name: adminName },
  });
  console.log(`Admin account ready: ${adminUser.email} (set/reset password via /admin/forgot-password).`);

  let created = 0;
  let skipped = 0;

  for (const ex of allExercises) {
    // Exercises migrated from BodyControl have a legacyId and are
    // deduped by it; the generic corrective-exercise templates have no
    // legacyId (Postgres allows multiple NULLs in a unique column, so we
    // can't findUnique on that) and are deduped by name instead.
    const existing = ex.legacyId
      ? await prisma.exercise.findUnique({ where: { legacyId: ex.legacyId } })
      : await prisma.exercise.findFirst({
          where: { providerId: provider.id, name: ex.name, legacyId: null },
        });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.exercise.create({
      data: {
        providerId: provider.id,
        legacyId: ex.legacyId ?? undefined,
        name: ex.name,
        nameEn: ex.nameEn ?? undefined,
        description: ex.description,
        language: ex.language,
        muscleGroups: ex.muscleGroups,
        equipment: ex.equipment,
        unit: ex.unit,
        pauseSeconds: ex.pauseSeconds,
        sets: ex.sets,
        intensity: ex.intensity,
        notes: ex.notes ?? undefined,
        // Storage *paths* only — no working URLs yet. See README for the
        // video migration step that needs to happen before these are
        // replaced with real videoMaleUrl/videoFemaleUrl values.
        videoMalePath: ex.videoMalePath ?? undefined,
        videoFemalePath: ex.videoFemalePath ?? undefined,
        // Corrective Exercise tagging (NASM/Brookbush) — see
        // src/lib/corrective/rules.ts for how these are used.
        correctivePhase: (ex.correctivePhase as CorrectivePhase | null) ?? undefined,
        targetMuscles: ex.targetMuscles ?? [],
        taggingSource: ex.taggingSource ?? undefined,
        // Publish flag + SmartMotionApproach production spec (see
        // claude/SmartMotionApproach_Produktionsplan.md) — defaults to
        // true (undefined -> schema default) for exercises.json/
        // corrective-exercises.json, explicitly false for
        // draft-exercises.json entries awaiting video.
        isPublished: ex.isPublished ?? undefined,
        bibCategory: (ex.bibCategory as BibCategory | null) ?? undefined,
        level: (ex.level as ExerciseLevel | null) ?? undefined,
        productionRound: ex.productionRound ?? undefined,
        relevantSigns: ex.relevantSigns ?? [],
        relevantSignClusters: ex.relevantSignClusters ?? [],
        relevantSubsystems: ex.relevantSubsystems ?? [],
        rationale: ex.rationale ?? undefined,
        startPosition: ex.startPosition ?? undefined,
        execution: ex.execution ?? undefined,
        coachingCues: ex.coachingCues ?? [],
        commonMistakes: ex.commonMistakes ?? [],
        dosageNote: ex.dosageNote ?? undefined,
        regressionNote: ex.regressionNote ?? undefined,
        progressionNote: ex.progressionNote ?? undefined,
        contraindicationNote: ex.contraindicationNote ?? undefined,
        similarExistingDifference: ex.similarExistingDifference ?? undefined,
      },
    });
    created++;
  }

  console.log(`Exercise seed done: ${created} created, ${skipped} already existed.`);

  // Second pass: resolve similarExistingName (free text, since the seed
  // data doesn't carry the target's legacyId) into the actual
  // similarExistingExerciseId relation now that all exercises exist.
  let linked = 0;
  for (const ex of allExercises) {
    if (!ex.similarExistingName) continue;
    const self = await prisma.exercise.findFirst({
      where: { providerId: provider.id, name: ex.name },
    });
    if (!self || self.similarExistingExerciseId) continue; // already linked or missing

    // similarExistingName may reference one exercise or list a couple of
    // alternatives ("X / Y") — take the first as the primary link.
    const firstNameGuess = ex.similarExistingName.split(/\s*\/\s*/)[0].trim();
    const target = await prisma.exercise.findFirst({
      where: { providerId: provider.id, name: { contains: firstNameGuess, mode: "insensitive" } },
    });
    if (!target) continue;

    await prisma.exercise.update({
      where: { id: self.id },
      data: { similarExistingExerciseId: target.id },
    });
    linked++;
  }
  if (linked > 0) console.log(`Linked ${linked} draft exercise(s) to their similar-existing-exercise reference.`);

  // ============================================================
  // SmartMotion registry: attach smartMotionCode to already-seeded
  // exercises, create stub exercises for the rest, then seed the 22
  // Products (10 with full ProgramBlock/ProgramSession/
  // ProgramSessionExercise data — see README "SmartMotion-Programme").
  // ============================================================

  let smartMotionLinked = 0;
  for (const [code, ref] of Object.entries(smartMotionCodeToNameData as SmartMotionCodeMap)) {
    const match = await prisma.exercise.findFirst({
      where: { providerId: provider.id, name: ref.name },
    });
    if (!match) {
      console.warn(`  SmartMotion: no exercise named ${JSON.stringify(ref.name)} found for ${code} — skipping`);
      continue;
    }
    if (match.smartMotionCode === code) continue; // already linked from a prior run
    try {
      await prisma.exercise.update({ where: { id: match.id }, data: { smartMotionCode: code } });
      smartMotionLinked++;
    } catch (err) {
      // P2002 (unique constraint on smartMotionCode) happens when two
      // registry codes resolve to the same exercise `name` (an ambiguous
      // 1:many mapping the schema can't represent, since smartMotionCode
      // is 1:1 per Exercise) — a data issue in the registry/matching
      // step, not something that should crash the whole boot sequence
      // (this loop is best-effort metadata enrichment, not required for
      // the app to run). Log and move on; see scripts/match_smartmotion_
      // exercises.py for where to fix the underlying ambiguity.
      if ((err as { code?: string })?.code === "P2002") {
        console.warn(
          `  SmartMotion: could not set smartMotionCode=${code} on ${JSON.stringify(ref.name)} — that code (or that exercise) is already linked elsewhere. Skipping.`,
        );
        continue;
      }
      throw err;
    }
  }

  let smartMotionStubsCreated = 0;
  for (const stub of smartMotionStubExercisesData as SmartMotionStubExercise[]) {
    const existing = await prisma.exercise.findUnique({ where: { smartMotionCode: stub.smartMotionCode } });
    if (existing) continue;
    try {
      await prisma.exercise.create({
        data: {
          providerId: provider.id,
          smartMotionCode: stub.smartMotionCode,
          name: stub.name,
          correctivePhase: stub.correctivePhase as CorrectivePhase,
          unit: stub.unit,
          sets: stub.sets,
          pauseSeconds: stub.pauseSeconds,
          intensity: stub.intensity,
          muscleGroups: stub.muscleGroups,
          equipment: stub.equipment,
          targetMuscles: stub.targetMuscles,
          taggingSource: stub.taggingSource ?? undefined,
          isPublished: stub.isPublished,
          notes: stub.notes,
        },
      });
      smartMotionStubsCreated++;
    } catch (err) {
      // Same defensive handling as the linking loop above — don't let a
      // registry data ambiguity crash the boot sequence.
      if ((err as { code?: string })?.code === "P2002") {
        console.warn(`  SmartMotion: stub for ${stub.smartMotionCode} already exists (race with linking above) — skipping.`);
        continue;
      }
      throw err;
    }
  }
  console.log(`SmartMotion exercises: ${smartMotionLinked} linked to smartMotionCode, ${smartMotionStubsCreated} placeholder(s) created.`);

  const smartMotionProgramsById = new Map(
    (smartMotionProgramsData as SmartMotionProgram[]).map((p) => [p.id, p])
  );

  let productsUpserted = 0;
  let blocksCreated = 0;
  let sessionItemsCreated = 0;
  for (const entry of smartMotionProductsCatalogData as SmartMotionProductCatalogEntry[]) {
    const { cents, note } = parsePriceEur(entry.priceRaw);
    const product = await prisma.product.upsert({
      where: { providerId_slug: { providerId: provider.id, slug: entry.slug } },
      update: {},
      create: {
        providerId: provider.id,
        specId: entry.id,
        slug: entry.slug,
        category: entry.category as ProductCategory,
        title: entry.title,
        hook: entry.hook,
        description: entry.description,
        forYou: entry.forYou,
        cta: entry.cta,
        priceCents: cents,
        priceNote: note ?? undefined,
        isPublished: entry.launch,
        contentStatus: entry.contentStatus,
        frequency: entry.frequency,
        testRetestProtocol: entry.testRetestProtocol,
        specialLogicNote: entry.specialLogicNote ?? undefined,
        abschluss: smartMotionProgramsById.get(entry.id)?.abschluss ?? undefined,
      },
    });
    productsUpserted++;

    const program = smartMotionProgramsById.get(entry.id);
    if (!program) continue; // catalog-only this round — no ProgramBlock data yet, see README

    for (const block of program.blocks) {
      const existingBlock = await prisma.programBlock.findFirst({
        where: { productId: product.id, weekStart: block.weekStart },
      });
      if (existingBlock) continue; // already seeded in a prior run

      const createdBlock = await prisma.programBlock.create({
        data: {
          productId: product.id,
          weekStart: block.weekStart,
          weekEnd: block.weekEnd,
          progressionRule: block.progressionRule ?? "",
        },
      });
      blocksCreated++;

      for (const [label, session] of Object.entries(block.sessions)) {
        const createdSession = await prisma.programSession.create({
          data: { programBlockId: createdBlock.id, label },
        });

        for (const [phase, refs] of Object.entries(session)) {
          let order = 0;
          for (const ref of refs) {
            const exercise = await prisma.exercise.findUnique({ where: { smartMotionCode: ref.code } });
            if (!exercise) {
              console.warn(
                `  SmartMotion: ${entry.id} session ${label}/${phase} references ${ref.code} but no Exercise has that smartMotionCode — skipping item`
              );
              continue;
            }
            await prisma.programSessionExercise.create({
              data: {
                programSessionId: createdSession.id,
                exerciseId: exercise.id,
                phase: phase as CorrectivePhase,
                order: order++,
              },
            });
            sessionItemsCreated++;
          }
        }
      }
    }
  }
  console.log(
    `SmartMotion products: ${productsUpserted} upserted (of which ${smartMotionProgramsById.size} with full program data), ${blocksCreated} block(s), ${sessionItemsCreated} session item(s) created.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
