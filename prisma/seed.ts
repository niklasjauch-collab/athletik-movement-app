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
// MasterSpec_v2_126_Uebungen.md in the project) — data sources:
//   - prisma/seed-data/smartmotion-exercise-registry.json,
//     smartmotion-code-to-name.json, smartmotion-stub-exercises.json:
//     the spec's 126-entry "verbindliche" exercise registry (E001-E126,
//     the original 71 BodyControl-migrated + all 55 SmartMotionApproach
//     exercises from the Filming Guide), matched against the exercises
//     above by name, plus placeholder Exercise rows (isPublished:false)
//     for the ones that don't have a video yet — see
//     scripts/match_smartmotion_exercises.py, scripts/generate_
//     smartmotion_seed_data.py, and scripts/merge_filming_guide_into_
//     seed_data.py, which produced/enriched these from the specs (not
//     hand-authored).
//   - prisma/seed-data/smartmotion-products-catalog.json: all 22
//     products' catalog/marketing fields (title, hook, description,
//     price, ...), parsed from the v2 spec by
//     scripts/parse_smartmotion_spec_v2.py (supersedes the v1-only
//     scripts/parse_smartmotion_spec.py).
//   - prisma/seed-data/smartmotion-programs.json: full 12-week
//     block/session/exercise structure for ALL 22 products (v2 extended
//     this beyond v1's 10-launch-products-only scope once the 55 new
//     exercises made every product's plan fully specifiable) — only the
//     10 launch products (P01-P06, P08, P09, P15, P18) are
//     `isPublished:true`; the other 12 are seeded in full but stay
//     `isPublished:false` per the spec's launch strategy, not because
//     their data is incomplete.

import { PrismaClient, CorrectivePhase, BibCategory, ExerciseLevel, TrainingProgramCategory, ProductType } from "@prisma/client";
import exercisesData from "./seed-data/exercises.json";
import correctiveExercisesData from "./seed-data/corrective-exercises.json";
import draftExercisesData from "./seed-data/draft-exercises.json";
import smartMotionCodeToNameData from "./seed-data/smartmotion-code-to-name.json";
import smartMotionStubExercisesData from "./seed-data/smartmotion-stub-exercises.json";
import smartMotionProductsCatalogData from "./seed-data/smartmotion-products-catalog.json";
// smartmotion-programs.json (full 22-product/12-week dataset, ~200KB) is
// split into 4 parts purely for GitHub-web-upload commit-size reasons (the
// single combined file repeatedly failed to commit via the browser upload
// flow in the deployment sandbox) — content-wise this is identical to one
// file, just chunked. See scripts/parse_smartmotion_spec_v2.py, which
// writes the un-split smartmotion-programs.json; scripts/split_programs.py
// (or an equivalent one-off) chunks it into these 4 parts for upload.
import smartMotionProgramsPart1 from "./seed-data/smartmotion-programs-1.json";
import smartMotionProgramsPart2 from "./seed-data/smartmotion-programs-2.json";
import smartMotionProgramsPart3 from "./seed-data/smartmotion-programs-3.json";
import smartMotionProgramsPart4 from "./seed-data/smartmotion-programs-4.json";
const smartMotionProgramsData = [
  ...smartMotionProgramsPart1,
  ...smartMotionProgramsPart2,
  ...smartMotionProgramsPart3,
  ...smartMotionProgramsPart4,
];

const prisma = new PrismaClient();

type SmartMotionCodeMap = Record<string, { name: string; source: string }>;

type SmartMotionStubExercise = {
  smartMotionCode: string;
  name: string;
  nameEn?: string | null;
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
  // Filming Guide enrichment (see SmartMotionApproach_Filming_Guide_55_
  // Uebungen.md, scripts/parse_filming_guide_55.py +
  // scripts/merge_filming_guide_into_seed_data.py) — optional because the
  // original 41-entry stub batch predates this and some future stub
  // batches may again be added without full production detail yet.
  startPosition?: string | null;
  execution?: string | null;
  coachingCues?: string[];
  commonMistakes?: string[];
  contraindicationNote?: string | null;
  productionRound?: number | null;
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
  let smartMotionStubsEnriched = 0;
  for (const stub of smartMotionStubExercisesData as SmartMotionStubExercise[]) {
    const existing = await prisma.exercise.findUnique({ where: { smartMotionCode: stub.smartMotionCode } });
    const stubFields = {
      nameEn: stub.nameEn ?? undefined,
      startPosition: stub.startPosition ?? undefined,
      execution: stub.execution ?? undefined,
      coachingCues: stub.coachingCues ?? [],
      commonMistakes: stub.commonMistakes ?? [],
      contraindicationNote: stub.contraindicationNote ?? undefined,
      productionRound: stub.productionRound ?? undefined,
    };
    if (existing) {
      // Re-running seed after a Filming Guide enrichment pass (see
      // scripts/merge_filming_guide_into_seed_data.py) should update
      // already-seeded placeholder rows with the newly-added production
      // detail (startPosition/execution/coachingCues/commonMistakes/
      // contraindicationNote) rather than silently skipping them —
      // this data is coach-authored spec content, not user-editable, so
      // overwriting on every seed run is safe/idempotent.
      const hasNewDetail = stub.startPosition || stub.execution || (stub.coachingCues?.length ?? 0) > 0;
      if (hasNewDetail) {
        await prisma.exercise.update({ where: { id: existing.id }, data: stubFields });
        smartMotionStubsEnriched++;
      }
      continue;
    }
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
          ...stubFields,
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
  console.log(
    `SmartMotion exercises: ${smartMotionLinked} linked to smartMotionCode, ${smartMotionStubsCreated} placeholder(s) created, ${smartMotionStubsEnriched} existing placeholder(s) enriched with Filming Guide detail.`,
  );

  const smartMotionProgramsById = new Map(
    (smartMotionProgramsData as SmartMotionProgram[]).map((p) => [p.id, p])
  );

  let productsUpserted = 0;
  let blocksCreated = 0;
  let sessionItemsCreated = 0;
  for (const entry of smartMotionProductsCatalogData as SmartMotionProductCatalogEntry[]) {
    const { cents, note } = parsePriceEur(entry.priceRaw);
    const trainingProgram = await prisma.trainingProgram.upsert({
      where: { providerId_slug: { providerId: provider.id, slug: entry.slug } },
      update: {},
      create: {
        providerId: provider.id,
        specId: entry.id,
        slug: entry.slug,
        category: entry.category as TrainingProgramCategory,
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
        where: { trainingProgramId: trainingProgram.id, weekStart: block.weekStart },
      });
      if (existingBlock) continue; // already seeded in a prior run

      const createdBlock = await prisma.programBlock.create({
        data: {
          trainingProgramId: trainingProgram.id,
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

  // --- CoachAdmin briefing §6: the 6 standard customer segments. ---
  // Idempotent upsert on [providerId, key] — safe to re-run every deploy.
  // isSystemDefault:true just marks these as the seeded defaults for the
  // admin UI (e.g. to discourage accidental deletion); it doesn't block a
  // coach from creating further custom segments (§6's explicit
  // requirement) or editing these ones' name/description/color.
  const STANDARD_SEGMENTS: { key: string; name: string; description: string; colorHex: string }[] = [
    { key: "standard", name: "Standardkunde", description: "Normale, aktuelle Konditionen.", colorHex: "#64748b" },
    { key: "beta-tester", name: "Beta Tester", description: "Kostenloser oder individuell definierter Zugang.", colorHex: "#8b5cf6" },
    { key: "friends-family", name: "Freunde & Familie", description: "Individuelle kostenlose oder vergünstigte Konditionen.", colorHex: "#ec4899" },
    { key: "legacy", name: "Altkunde / Legacy", description: "Alte Preise, Links und Paketbedingungen.", colorHex: "#f59e0b" },
    { key: "partner", name: "Partner", description: "Z. B. GetImpulse, EvoGolf.", colorHex: "#0ea5e9" },
    { key: "vip", name: "VIP / individuell", description: "Für individuelle Sondervereinbarungen.", colorHex: "#22c55e" },
  ];
  const segmentsByKey = new Map<string, { id: string }>();
  for (const seg of STANDARD_SEGMENTS) {
    const created = await prisma.customerSegment.upsert({
      where: { providerId_key: { providerId: provider.id, key: seg.key } },
      update: {},
      create: {
        providerId: provider.id,
        key: seg.key,
        name: seg.name,
        description: seg.description,
        colorHex: seg.colorHex,
        isSystemDefault: true,
      },
    });
    segmentsByKey.set(seg.key, created);
  }
  console.log(`Customer segments: ${STANDARD_SEGMENTS.length} standard segment(s) ensured.`);

  // --- CoachAdmin briefing §65: default commercial products + §18 their
  // booking links. Prices/URLs are the exact real values already in
  // production use on src/lib/bookingOffers.ts's hardcoded customer-
  // facing list (Runde 4) — this seed migrates that data into the real
  // Product/BookingLink tables so /app/appointments can read it from the
  // DB instead (§66 "customer view must be derived, not duplicated").
  // One dedicated BookingLink per product (matches §18's own example
  // list, which names "15er/30er/45er Standard" as separate entries even
  // though several share the same underlying Calendly event) — a
  // BookingLink is scoped to exactly one product, so reusing one row
  // across products isn't a valid modeling choice here. Only the offers
  // with a genuine distinct Calendly link are seeded; Beta/Friends/
  // Legacy-specific links are NOT invented (no such distinct Calendly
  // event exists yet) — a coach adds those for real via
  // /admin/booking-links once they exist, same "honest empty state"
  // pattern used elsewhere in this app.
  const EINZEL_URL =
    process.env.MOVEMENT_SINGLE_CALENDLY_URL ||
    "https://calendly.com/athletikmovement/movement-coaching-corrective-exercise";
  const DEFAULT_PRODUCTS: {
    key: string;
    name: string;
    type: ProductType;
    priceCents: number;
    credits?: number;
    bookingLinkName: string;
    bookingLinkUrl: string;
  }[] = [
    { key: "smartmotionscan", name: "SmartMotionScan", type: "SMARTMOTION_SCAN", priceCents: 49900, bookingLinkName: "SmartMotionScan Standard", bookingLinkUrl: "https://calendly.com/athletikmovement/smartmotionscan" },
    { key: "movement-coaching-einzel", name: "Movement Coaching – Einzelsession", type: "COACHING_SESSION", priceCents: 25000, bookingLinkName: "Movement Coaching Einzel Standard", bookingLinkUrl: EINZEL_URL },
    { key: "movement-coaching-15er", name: "Movement Coaching – 15er Paket", type: "COACHING_PACKAGE", priceCents: 270000, credits: 15, bookingLinkName: "Movement Coaching 15er Standard", bookingLinkUrl: EINZEL_URL },
    { key: "movement-coaching-30er", name: "Movement Coaching – 30er Paket", type: "COACHING_PACKAGE", priceCents: 495000, credits: 30, bookingLinkName: "Movement Coaching 30er Standard", bookingLinkUrl: EINZEL_URL },
    { key: "movement-coaching-45er", name: "Movement Coaching – 45er Paket", type: "COACHING_PACKAGE", priceCents: 675000, credits: 45, bookingLinkName: "Movement Coaching 45er Standard", bookingLinkUrl: EINZEL_URL },
  ];
  let defaultProductsUpserted = 0;
  let defaultBookingLinksUpserted = 0;
  for (const p of DEFAULT_PRODUCTS) {
    const product = await prisma.product.upsert({
      where: { providerId_key: { providerId: provider.id, key: p.key } },
      update: {},
      create: {
        providerId: provider.id,
        key: p.key,
        name: p.name,
        type: p.type,
        priceCents: p.priceCents,
        credits: p.credits ?? null,
      },
    });
    defaultProductsUpserted++;

    await prisma.bookingLink.upsert({
      where: { providerId_key: { providerId: provider.id, key: `${p.key}-standard` } },
      update: {},
      create: {
        providerId: provider.id,
        key: `${p.key}-standard`,
        name: p.bookingLinkName,
        url: p.bookingLinkUrl,
        type: "Standard",
        productId: product.id,
        active: true,
      },
    });
    defaultBookingLinksUpserted++;
  }

  // Real example of §19's segment-level resolution (priority 2): the
  // "Partner" segment (GetImpulse/EvoGolf, per its own seeded
  // description above) gets its own real Calendly event — GetImpulse's
  // is a genuine distinct event on the connected account; EvoGolf has no
  // distinct event yet, so only GetImpulse is wired here. Deliberately
  // NOT attached to a specific product (segmentId set, productId null) —
  // it's a segment-wide override, not a product-specific one.
  await prisma.bookingLink.upsert({
    where: { providerId_key: { providerId: provider.id, key: "movement-coaching-getimpulse" } },
    update: {},
    create: {
      providerId: provider.id,
      key: "movement-coaching-getimpulse",
      name: "Movement Coaching GetImpulse",
      url: "https://calendly.com/athletikmovement/getimpulse",
      type: "Partner",
      segmentId: segmentsByKey.get("partner")?.id ?? null,
      active: true,
    },
  });
  defaultBookingLinksUpserted++;

  console.log(`Products: ${defaultProductsUpserted} default product(s) ensured, ${defaultBookingLinksUpserted} booking link(s) ensured.`);

  // --- customerNumber backfill (see schema.prisma's Client.customerNumber
  // comment for why this is a runtime backfill rather than a NOT NULL
  // migration) --- assigns "AM-0001"-style numbers to any client that
  // doesn't have one yet, continuing from the current highest number so
  // re-running this is a no-op for already-numbered clients and never
  // reuses a number.
  const clientsMissingNumber = await prisma.client.findMany({
    where: { providerId: provider.id, customerNumber: null },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (clientsMissingNumber.length > 0) {
    const numbered = await prisma.client.findMany({
      where: { providerId: provider.id, customerNumber: { not: null } },
      select: { customerNumber: true },
    });
    let maxN = 0;
    for (const c of numbered) {
      const m = /^AM-(\d+)$/.exec(c.customerNumber ?? "");
      if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
    }
    for (const c of clientsMissingNumber) {
      maxN += 1;
      await prisma.client.update({
        where: { id: c.id },
        data: { customerNumber: `AM-${String(maxN).padStart(4, "0")}` },
      });
    }
  }
  console.log(`Customer numbers: ${clientsMissingNumber.length} client(s) backfilled with a customerNumber.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
