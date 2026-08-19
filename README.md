# Movura

Booking, payments, packages and digital training plans for movement &
therapy professionals — built on Calendly + Stripe. See the full concept
document for the product rationale, the Calendly/Stripe integration
strategy, the white-label architecture and the legal/DSGVO notes.

This repo is a **Phase 1 scaffold** (see the concept doc's roadmap,
section 9): it establishes the project structure, the data model and the
white-label branding foundation, but the actual Calendly/Stripe/database
wiring is stubbed out with `TODO` comments — that's the next work.

## What's in here

```
prisma/schema.prisma        Data model: Provider, Service, Client,
                             CreditBalance, Booking, Order, DigitalProduct,
                             Exercise, TrainingPlan, TrainingPlanExercise,
                             MovementScan, MovementFinding, CorrectivePlan,
                             CorrectivePlanItem, Session, PasswordResetToken,
                             Product, ProgramBlock, ProgramSession,
                             ProgramSessionExercise, ProductAssessment.
                             Every table carries a providerId from day
                             one, so this is multi-tenant / white-label
                             ready.

scripts/parse_smartmotion_spec.py, match_smartmotion_exercises.py,
generate_smartmotion_seed_data.py, verify-smartmotion-seed.mjs
                             Parses SmartMotion_App_22_Programme_Claude_
                             MasterSpec.md (saved in your Claude Project)
                             into prisma/seed-data/smartmotion-*.json,
                             matches its 116-entry exercise registry
                             against already-seeded exercises, generates
                             placeholder Exercise rows for the rest, and
                             verifies every reference resolves -- see
                             "SmartMotion-Programme" below.

prisma/seed-data/exercises.json
                             71 exercises migrated 1:1 from the legacy
                             BodyControl app's exercise library (name,
                             description, muscle groups, equipment, sets,
                             pause, intensity, notes, video storage paths),
                             best-effort auto-tagged with correctivePhase +
                             targetMuscles by seed-data/tag-exercises.py.

prisma/seed-data/corrective-exercises.json
                             ~37 generic Corrective Exercise templates
                             (SMR / stretch / activation exercises), hand-
                             authored from the NASM CES textbook's Sample
                             Corrective Exercise Program tables by
                             seed-data/generate-corrective-exercises.py.
                             Exists so the plan generator always has a
                             candidate per phase/muscle even before the
                             71 BodyControl exercises are fully reviewed.

src/lib/corrective/rules.ts  The rule engine's reference data: every OHSA-
                              style compensation mapped to its Inhibit/
                              Lengthen/Activate muscle targets and
                              suggested Integrate movements. Source: the
                              NASM CES textbook + Brookbush Institute
                              materials the user uploaded to the Claude
                              Project (see claude/NASM_CES_Corrective_
                              Strategies_Zusammenfassung.md there).

src/lib/corrective/generatePlan.ts
                              Pure function: findings -> ordered Inhibit/
                              Lengthen/Activate/Integrate exercise plan.
                              No DB dependency, unit-testable — see
                              scripts/verify-corrective-plan.ts for a
                              runnable sanity check (`npx tsx scripts/
                              verify-corrective-plan.ts`).

src/app/scans/page.tsx        SmartMotionScan upload + findings checklist
                               + generated Corrective Exercise plan, all
                               working client-side today (no DB needed to
                               try it locally) — see "Corrective Exercise
                               plans" below for the full explanation.

prisma/seed.ts               Seeds the Movura Provider row + all 71 +
                              generic exercises from seed-data/*.json.
                              Run with `npm run seed` once the database is
                              connected and migrated.

src/lib/branding.ts          Single source of truth for the current tenant's
                              name, tagline, logo, color. Currently hardcoded
                              to Athletik Movement, the beta tenant — swap
                              for a database lookup by domain once a second
                              brand goes live (Phase 4).

src/lib/db.ts                 Prisma client singleton (standard Next.js
                               hot-reload-safe pattern). SANDBOX-ONLY
                               @ts-nocheck — see "Getting started locally".

src/lib/auth.ts                Client-facing auth: password hashing,
                                database sessions, password-reset tokens,
                                getCurrentClient(). SANDBOX-ONLY @ts-nocheck.

src/lib/tenant.ts              Resolves the single active Provider
                                (Athletik Movement) row. SANDBOX-ONLY
                                @ts-nocheck.

src/lib/email.ts               Minimal email-sending stub (logs instead of
                                sending until RESEND_API_KEY is wired up).

src/lib/corrective/splitIntoSessions.ts
                                Decides 1 vs. 2 CorrectivePlans from a
                                scan's findings by severity — see
                                "Automatischer Scan-zu-Plan-Workflow".

src/app/register/, /login/, /forgot-password/, /reset-password/
                                Client-facing auth pages.

src/app/portal/page.tsx        Client-facing read-only view of their own
                                current + past Corrective Exercise plan(s).

src/app/clients/, src/app/clients/[id]/
                                Coach-facing client list + detail page
                                (scan upload -> automatic plan generation).

src/app/api/auth/*/route.ts    register, login, logout, forgot-password,
                                reset-password endpoints.

src/app/api/clients/[id]/scans/route.ts
                                THE automatic pipeline: upload -> AI
                                analysis -> findings -> plan(s), all in one
                                request, no manual review step (unlike
                                /api/scans/analyze).

src/components/CorrectivePlanCard.tsx
                                Shared read-only plan rendering used by
                                both /portal and /clients/[id].

src/app/manifest.ts          Generates the PWA manifest from branding.ts, so
                              "Add to Home Screen" already reflects whichever
                              tenant is running.

src/app/page.tsx              Public booking page. Has a placeholder box
                              where the real Calendly inline embed goes
                              (see the TODO comment in the file) and a
                              placeholder services list (to be replaced by
                              a Prisma query).

src/app/shop/page.tsx          Digital products shop placeholder (training
                                plans). Buy button is not wired to Stripe yet.

src/app/api/webhooks/calendly/route.ts
                              Calendly webhook endpoint stub for
                              invitee.created / invitee.canceled.
                              Signature verification is a TODO.

src/app/api/webhooks/stripe/route.ts
                              Stripe webhook endpoint stub for
                              checkout.session.completed.
                              Signature verification is a TODO.

.env.example                  All environment variables you'll need across
                               Phase 1-3, with comments on where each comes
                               from.
```

## Getting started locally

```bash
npm install
cp .env.example .env.local   # fill in the values as you set up each service
npm run dev
```

Note: `prisma generate`/`prisma init` could not download its binary in the
sandbox this was built in (network allowlist: `binaries.prisma.sh` returns
403), so the Prisma client hasn't been generated here yet. Once you have
`DATABASE_URL` set on a machine with normal internet access, run:

```bash
npx prisma generate
npx prisma migrate dev --name init
npm run seed   # creates the Athletik Movement provider + exercise library
```

**What this means for the code you're receiving**: everything under
`src/lib/auth.ts`, `src/lib/db.ts`, `src/lib/tenant.ts`, `/register`,
`/login`, `/forgot-password`, `/reset-password`, `/portal`, `/clients`,
`/clients/[id]` and their API routes is written against the real,
generated `@prisma/client` — standard Next.js + Prisma code, nothing
sandbox-specific in the logic itself. But because `@prisma/client` has no
generated engine here, **`npm run build` cannot fully complete in this
sandbox** — it gets past compiling and type-checking (`tsc` is clean, see
below) but fails during Next's "Collecting page data" step, which
actually *executes* the module graph and hits the same missing-engine
error. This is a deeper version of the already-known Prisma CLI
limitation: it's not just `prisma generate`/`migrate` that can't run
here, ANY code path that imports `@prisma/client` can't execute here
either, at build- or run-time. Once you run `npx prisma generate` on a
real machine, `npm run build` / `npm run dev` will work normally — this
isn't something you need to fix in the code.

**How this was verified instead, given that constraint**:
- `npx tsc --noEmit` — clean (0 errors) across the whole project.
- `npx eslint .` — clean (0 errors/warnings) across the whole project.
- `npm run build`'s first two steps (Turbopack compile + TypeScript
  check) both succeed; only the page-data-collection step fails, for the
  reason above.
- The three Prisma-boundary files (`src/lib/db.ts`, `src/lib/auth.ts`,
  `src/lib/tenant.ts`) carry a `@ts-nocheck` with an explanation — remove
  it once you've run `prisma generate` and can type-check them for real.
  A few `.map()`/`.filter()` callbacks in `/portal`, `/clients`,
  `/clients/[id]` are annotated `: any` for the same reason (their input
  comes from a Prisma query result) — also safe to remove once the real
  types exist; search the codebase for `SANDBOX-ONLY` to find every spot.
- The **auth logic itself** (hashing, session creation, cookie handling,
  password-reset token lifecycle: create → verify → consume → invalidate
  old sessions) was proven correct against a real local Postgres instance
  using hand-written SQL DDL + a standalone `bcryptjs`/`pg`/`crypto`
  script mirroring `src/lib/auth.ts`'s logic exactly (all 13 assertions
  passed — registration, duplicate-email rejection, correct/wrong-password
  login, session-to-client resolution, forged-token rejection, reset-token
  lifecycle, old-session invalidation after reset). The script was deleted
  after the run since it isn't part of the shipped app.
- The **plan-generation logic** (`generatePlan.ts` + `splitIntoSessions.ts`)
  was proven correct with a standalone script run against the real seed
  exercise data and the Susanna Dulkinys example scan — see "Automatischer
  Scan-zu-Plan-Workflow" below for the results. Neither module touches
  Prisma (both are pure functions), so this ran without hitting the
  sandbox limitation at all.

## Exercise library migration (from BodyControl)

The full exercise library (71 exercises) was migrated from the legacy app
at `admin.bodycontrol.io/de/exercises/list` and is ready to seed into
Movura's database:

- **Text data**: name, description, language, muscle groups, equipment,
  unit (seconds-held vs. rep-based), rest between sets, per-set values,
  intensity and notes — all captured for every exercise and stored in
  `prisma/seed-data/exercises.json`. Run `npm run seed` (after
  `prisma migrate dev`) to load them into the `Exercise` table, linked to
  the Movura provider row.
- **Videos — action needed on your side**: the actual video *files*
  (male/female demo clips) live in your BodyControl Firebase Storage
  bucket, at paths like
  `trainers/013TM5QJKHfEq3xn66gLblzlwst2/media/exercises/{exerciseId}/{male|female}/video/{file}.mp4`.
  I captured these paths (stored per-exercise as `videoMalePath` /
  `videoFemalePath` in the seed data) so every clip can be matched to the
  right exercise, but I could not download the actual video *files* into
  this workspace — the sandbox's network access doesn't reach Firebase
  Storage, and the signed download URLs are (correctly) redacted by the
  browser tooling's own safety filters rather than something to work
  around. To finish the migration:
  1. From the Firebase console (or `gsutil -m cp -r
     gs://<your-bucket>/trainers/013TM5QJKHfEq3xn66gLblzlwst2/media/exercises
     ./bodycontrol-videos`), export the `media/exercises/` folder — you
     have owner access to that project.
  2. Upload the resulting files to wherever Movura will serve media from
     (e.g. a Supabase/S3 bucket, or Vercel Blob), keeping the same
     `{exerciseId}/{male|female}/video/{file}` structure so they line up
     1:1 with `legacyId` in the `Exercise` table.
  3. Run a small script that reads each `Exercise.legacyId` +
     `videoMalePath`/`videoFemalePath`, resolves the new hosted URL, and
     writes it into `videoMaleUrl`/`videoFemaleUrl`.
  4. One exercise (`Mff997UZZSBD4BmlIrng`, "SMR Hamstrings") had no video
     in the legacy app at all — not a migration gap, just confirmed
     missing at the source.

## Corrective Exercise plans (SmartMotionScan -> automatic plan)

You can upload a SmartMotionScan (or any movement-assessment) result for a
client and have Movura auto-generate an individual Corrective Exercise
plan from it, following the NASM Corrective Exercise Continuum /
Brookbush SmartMotionApproach (Inhibit -> Lengthen -> Activate ->
Integrate). Try it today at `/scans` — no database needed, it runs
entirely client-side against the seeded exercise data.

**Note**: `/scans` is the original manual-review demo flow described in
this section (findings checklist, coach clicks "Plan generieren").
There's now also a real, Prisma-backed, fully automatic version of this
same idea for registered clients at `/clients/[id]` — see "Athletik
Movement: Branding, Kunden-Login & automatischer Scan-zu-Plan-Workflow"
below. Both stay in the app: `/scans` as a no-login, no-database way to
demo/test the plan generator against any client name, `/clients/[id]` as
the real production path tied to an actual registered client account.

**Why findings are entered by the coach rather than parsed automatically
from the uploaded file**: SmartMotionScan reports are produced by a
third-party platform (Moti Physio 2), and there's no sample export or
documented API to build a reliable parser against. Rather than guess at
a proprietary report format, the workflow mirrors how NASM/Brookbush
teach the assessment-to-program process anyway: review the report,
record which compensations are present (the `/scans` findings checklist
— Feet Flatten, Knees Move Inward, Arms Fall Forward, etc., with a
left/right/bilateral selector for asymmetric ones), and the app looks up
the corrective strategy from there. This is more reliable than OCR/parsing
would be, and it's exactly the "record findings, then generate the
program" step a human coach does today — the app just automates the
lookup and exercise selection instead of you cross-referencing tables by
hand.

**How the plan is generated** (`src/lib/corrective/`):
1. Each recorded compensation maps to a list of target muscles per phase
   (Inhibit/Lengthen/Activate) plus a suggested Integrate movement — this
   mapping (`rules.ts`) is transcribed from the NASM CES textbook's
   "Sample Corrective Exercise Program" tables and cross-referenced
   against the Brookbush OHSA material, both of which are saved in your
   Claude Project for reference/audit.
2. Muscle targets from all recorded findings are merged per phase.
3. For each muscle, the exercise library (both your 71 BodyControl
   exercises and the generic NASM-derived templates) is searched for a
   tagged match; ties prefer manually-verified tags over auto-tagged ones.
4. Any muscle/movement the rule engine wanted but found no exercise for
   is surfaced as a visible gap in the UI rather than silently dropped.

**Data quality note — please review before relying on this clinically**:
the 71 migrated BodyControl exercises were only tagged with broad muscle
*groups* ("Beine", "Bauch"), not the specific muscles (e.g.
"Gastrocnemius") the rule engine needs. `prisma/seed-data/tag-exercises.py`
best-effort auto-tags them by matching keywords in each exercise's own
German description against a muscle-name dictionary (62/71 exercises got
tagged this way; the remaining 9 target muscles outside the current rule
set — e.g. VMO, Quadratus Lumborum — and were deliberately left untagged
rather than force-matched). Spot-check the auto-tagged exercises in the
`/exercises` view before trusting the generated plans with real clients,
and mark any you've reviewed as `taggingSource: "verified"` in the
database so the generator prefers them over unreviewed auto-tags.

**Still to do to make this production-ready**:
- Wire `/api/scans/upload` to real object storage (see the TODO in that
  file — it currently writes to the local filesystem, which does not
  work on Vercel's serverless functions) and persist `MovementScan`/
  `MovementFinding`/`CorrectivePlan` rows via Prisma instead of keeping
  everything in client-side React state.
- Add authentication so `/scans`, `/training` and `/progress` are
  coach-only, not public.
- Consider expanding `rules.ts` with more compensations/muscles as you
  encounter real SmartMotionScan findings it doesn't yet cover.
- Rate-limit `/api/scans/analyze` (each call is a paid API request) once
  it's exposed beyond local testing.

## Athletik Movement: Branding, Kunden-Login & automatischer Scan-zu-Plan-Workflow

Athletik Movement is the platform's first real (beta) tenant. Three
things changed to make that real, not just a rename:

**1. Branding** (`src/lib/branding.ts`, `public/brand/`) — app name,
tagline, logo (header + a square lockup mark for auth screens), color
scale (`brand-*`/`ink-*` in `globals.css`, derived from the logo's own
colors and checked for WCAG contrast so `brand-600` is safe for white
button text — 5.1:1), and the PWA manifest/favicon all point at Athletik
Movement now. `prisma/seed.ts` creates the matching `Provider` row
(`slug: "athletik-movement"`). This is still a single hardcoded tenant
(see the TODO in `branding.ts`) — swapping in a second brand later means
replacing `getBranding()`/`getActiveProvider()` with a real per-request
lookup, not touching every page that calls them.

**2. Client-facing authentication** (`src/lib/auth.ts`, `/register`,
`/login`, `/forgot-password`, `/reset-password`) — clients self-register
with Vorname/Nachname/E-Mail, then set a password; **the email is always
the username** (`Client` has `@@unique([providerId, email])`, and
`/api/auth/login` looks clients up by it). Sessions are server-side and
revocable, not stateless JWTs: the cookie holds a random 32-byte token,
and only its SHA-256 hash is stored in the new `Session` table — a
database leak alone can't be replayed as a valid login. Same
hash-at-rest pattern for `PasswordResetToken` (1-hour expiry, single-use,
invalidates every existing session on successful reset — so a stolen
session can't survive the real owner resetting their password).
`/forgot-password` always returns the same message whether or not the
email is registered, so it can't be used to check which emails have
accounts; without `RESEND_API_KEY` configured (see `.env.example`), the
reset email is logged to the console and the link is also echoed back in
the page itself, clearly marked "Dev-Modus", so the flow is testable
without a mail provider. `getCurrentClient()` (used by `layout.tsx` for
the header, and by `/portal`) never throws — any failure (no cookie,
expired session, DB error) is treated as "logged out", per the Next.js
16 auth guide's Data Access Layer pattern.

This is **client (end-customer) auth only**. The coach side (`/clients`,
`/scans` upload) still has no login of its own — seeded on the
single-operator assumption that only you use those pages. Adding coach
auth is the natural next step once more than one person needs coach
access (see "What's next").

**3. Automatischer Scan-zu-Plan-Workflow (`/clients`, `/clients/[id]`,
`src/app/api/clients/[id]/scans/route.ts`)** — this is the "ohne dass ich
weitere Schritte machen muss" requirement. It's a real, DB-backed sibling
of the `/scans` demo flow, built specifically so uploading a scan for a
registered client does everything in one request:

1. The coach opens a client's page at `/clients/[id]` (clients appear
   here once they've self-registered — there's deliberately no "add
   client" form, since the coach doesn't create these accounts) and
   uploads the SmartMotionScan PDF.
2. The report is read by `analyzeScanDocument()` (same AI-analysis
   module `/scans` uses, extended this round with an optional
   `severity` field — MILD/MODERATE/SEVERE — that the model only sets
   when the source report itself states one).
3. **Unlike `/scans`**, the proposed findings are committed straight to
   `MovementFinding` — no coach review checklist step — since
   `analyzeScanDocument`'s own system prompt already constrains it to
   only report compensations the document actually documents.
4. `splitIntoSessions.ts` (new) decides whether the findings fit one
   plan or need two: more than 5 distinct findings splits them into
   **"Plan A — Schwerpunkt"** (the higher-severity half, SEVERE findings
   first) and **"Plan B — Ergänzend"** (the rest) — two complete,
   independent Inhibit→Integrate sessions meant to be alternated across
   the week, rather than one overloaded list. 5-or-fewer findings still
   produce a single unlabeled plan, matching the "normal" case.
5. Both plans are generated via the existing `generatePlan.ts` and
   persisted (`CorrectivePlan` + `CorrectivePlanItem` rows) in the same
   request — the coach sees the result immediately, with zero further
   clicks.
6. The client sees their current plan(s) automatically on `/portal` the
   next time they log in (older scans' plans are kept, collapsed under
   "Ältere Pläne").

**Verified with the real example**: since this sandbox has no
`ANTHROPIC_API_KEY` configured, the AI-extraction step (point 2 above)
couldn't be run end-to-end here. To still verify the pipeline's actual
decision logic, the Susanna Dulkinys SmartMotionScan report you attached
was hand-mapped onto the `Compensation` enum (7 mappable findings:
`EXCESSIVE_FORWARD_LEAN`/SEVERE, `ARMS_FALL_FORWARD`/MODERATE,
`LOW_BACK_ROUNDS`/MODERATE, `SHOULDER_ELEVATION`/MODERATE,
`LOW_BACK_ARCHES`/MODERATE, `FORWARD_HEAD`/MILD,
`KNEES_MOVE_INWARD`/MILD — two report findings, a spinal scoliosis note
and an ambiguous front-knee asymmetry without a clear inward/outward
direction, don't map cleanly onto the current enum and were correctly
left out, exactly as the AI step itself would do) and run through
`splitIntoSessions.ts` + `generatePlan.ts` directly against the real
seed exercise data in a standalone script. Result: **7 findings → split
into 2 plans**, Plan A led with the SEVERE finding as intended, Plan B
got the remaining MODERATE/MILD ones.

**Known limitation surfaced by that same test, worth knowing about
before relying on this clinically**: `generatePlan.ts` picks one
exercise per target *muscle*, and each compensation's NASM table
typically lists several muscles per phase — so a plan with 4 findings
came out to **28 exercises** (8 Inhibit + 8 Lengthen + 7 Activate + 5
Integrate) in this test, which is more than a realistic single session.
`splitIntoSessions.ts` solves "too many *findings*" but doesn't yet cap
"too many *exercises per phase*" — the natural follow-up is having
`generatePlan.ts` (or a step after it) keep only the top few
highest-priority exercises per phase instead of one per muscle. Flagging
this now rather than silently shipping 28-exercise sessions.

## SmartMotion-Programme (22 verkaufbare 12-Wochen-Programme)

Distinct from the automatic scan → CorrectivePlan pipeline above: this is
a **catalog of pre-authored, sellable 12-week programs** (e.g. "P01 —
Stabile Beinachse") a client purchases and follows on a fixed weekly
schedule, not something generated from their own assessment data. The
binding source for all product copy, pricing, launch status and every
week's exact session content is `SmartMotion_App_22_Programme_Claude_
MasterSpec.md`, saved in your Claude Project (`claude/` — same place as
the other reference docs like `SmartMotionApproach_Produktionsplan.md`)
rather than committed into this repo, matching how those are handled.

**Scope of this round** (by your choice, when there were several options
for how much to build at once): **data model + the 10 launch products'
full 12-week content**, seeded and ready. Admin panel, purchase/unlock
logic (Stripe), and the other 12 products' week-by-week session data are
explicitly **not** built yet — see "What's next".

**New Prisma models** (`prisma/schema.prisma`): `Product` (catalog/
marketing fields: title, hook, description, "für dich, wenn", CTA,
price, frequency, content status, test/re-test protocol), `ProgramBlock`
(one 4-week block — weeks 1-4/5-8/9-12 — with its progression rule),
`ProgramSession` ("A" or "B", alternated across a block),
`ProgramSessionExercise` (one exercise slot, referencing `Exercise` by ID
only — never copying exercise content into a program, per the spec's
explicit requirement), and `ProductAssessment` (a client's week 0/4/8/12
Test/Re-Test checkpoint; `testValues` is `Json` because each product's
test protocol is completely different — Overhead Squat 0/1/2 scores for
P01 vs. Sit-to-Stand reps for P09 — so a fixed relational shape would
mean a wide, mostly-null table). `Exercise` gained one new field,
`smartMotionCode` (e.g. `"E002"`), linking it to the spec's own
116-entry "verbindliche" exercise registry.

**How the 10 launch products' data got into the database** (all under
`scripts/`, not hand-transcribed): the spec document is large (2400+
lines) and mechanically regular — every product's 12-week plan follows
the exact same `#### W1-4` / `**Session A:**` / `**MoveFlexRelax – ...:**
**E002 – Name** `[STATUS]`` structure — so a parser is far less
error-prone at this scale than manually re-typing ~370 structured
exercise references by hand:
1. `scripts/parse_smartmotion_spec.py` — parses the spec into
   `prisma/seed-data/smartmotion-exercise-registry.json` (the 116-entry
   E001-E116 registry), `smartmotion-products-catalog.json` (all 22
   products' catalog fields), and `smartmotion-programs.json` (full
   week/session/exercise structure for the 10 launch products).
2. `scripts/match_smartmotion_exercises.py` — matches each of the 116
   registry entries against the exercises **already** seeded
   (`exercises.json`/`corrective-exercises.json`/`draft-exercises.json`)
   by normalized name, plus a short manually-verified alias list for the
   ~11 that needed one (minor wording differences, or — for 3 of the
   already-drafted SmartMotionApproach production-pipeline exercises — an
   earlier German working title for the same exercise, confirmed by
   cross-checking `correctivePhase` and description, not just the name).
3. `scripts/generate_smartmotion_seed_data.py` — for the 41 registry
   entries actually used by the 10 launch programs that don't match an
   existing exercise, generates a **placeholder** Exercise row
   (`smartmotion-stub-exercises.json`): name, phase and `smartMotionCode`
   come straight from the spec's own registry ("Diese IDs sind
   verbindlich"), but rationale/execution/coaching cues/video are
   deliberately left for the separate SmartMotionApproach production
   pipeline (see below) — this script does not invent clinical content.
   Dosage (sets/unit/pause) is a provisional placeholder taken from the
   spec's own Wochen-1-4-Basisdosierung (section 3), clearly flagged as
   such in each stub's `notes` field, not exercise-specific yet.
4. `prisma/seed.ts` (extended) links the 74 matched codes onto their
   existing `Exercise` rows, creates the 41 placeholder rows, then
   upserts all 22 `Product` rows (`isPublished` = the spec's own
   Launch JA/NEIN column — so this already produces exactly the 10 live +
   12 hidden split without any extra logic) and, for the 10 with full
   program data, their `ProgramBlock`/`ProgramSession`/
   `ProgramSessionExercise` rows.

**Verified without a working database** (same sandbox constraint as
elsewhere — see "Getting started locally"): `scripts/verify-smartmotion-
seed.mjs` simulates the exact two-step resolution `seed.ts` performs
(name → exercise, then `smartMotionCode` → exercise) in plain Node
against the real JSON seed files, no Prisma involved. Result: **all 368
exercise references across the 10 launch programs' sessions resolve**,
all 22 products present with exactly 10 marked launch, no duplicate
slugs, every catalog field populated, every price parses correctly.
Rerun it (`node scripts/verify-smartmotion-seed.mjs`) after any change to
the spec or the generator scripts.

**Content-integrity note (spec requirement #6)**: the 41 placeholder
exercises are seeded with `isPublished: false`, same convention as the
SmartMotionApproach production pipeline's unfilmed exercises (see
below) — so a `where: { isPublished: true }` filter already keeps them
out of anything client-facing. What's still missing before a launch
product can safely go live is the **check itself**: a script/query that
walks a `Product`'s `ProgramBlock`s and fails if any referenced exercise
is unpublished, so a coach gets a clear error instead of a client
silently landing on a broken session. Not built yet — see "What's next".

## AI-assisted plan generation, seiten-genaue Anweisungen, Trainingsdokumentation

Three additions on top of the base scan → plan flow above, all driven by
the same "coach reviews, app never decides blindly" philosophy.

**1. "PDF automatisch analysieren" (`src/lib/corrective/analyzeScan.ts`,
`/api/scans/analyze`)** — the original design deliberately avoided writing
a *parser* for SmartMotionScan's PDF export, since Moti Physio 2's format
isn't documented anywhere reliable to build one against (see the
`MovementScan` model comment in `schema.prisma`). Rather than parse the
file, this reads it the way a human would: the uploaded PDF/image is sent
to the Anthropic API with a forced structured tool-call
(`record_findings`), which returns a proposed list of OHSA compensations
+ side (links/rechts/beidseitig) + confidence + a short quote as evidence.
The `/scans` page pre-fills the SAME manual findings checklist from this —
each suggestion is tagged "🤖 KI-Vorschlag" and stays fully editable/
uncheckable — and nothing reaches the plan generator until the coach has
reviewed it. This keeps the "record findings, then generate the program"
workflow intact; it just automates the tedious transcription step.
Requires `ANTHROPIC_API_KEY` (and `ANTHROPIC_MODEL`, see `.env.example`)
— without it the button shows "nicht konfiguriert" and findings entry
stays fully manual, so the feature is optional, not a hard dependency.
**Before enabling in production**: sending a scan report to a third-party
API means sending client health data off-platform — make sure that's
covered by an AVV/DPA with Anthropic and by the client's informed consent
(see the concept doc's DSGVO/Gesundheitsdaten section).

**2. Side-aware plan items** — `MovementFinding.side` already existed for
the two compensations whose muscle targets differ by side, but the
`/scans` UI only showed a Links/Rechts/Beidseitig selector for those two.
Since almost any OHSA compensation can present unilaterally in practice
(one foot flattening, one knee caving in, etc.), every compensation now
gets that selector. `generatePlan.ts` tracks which side(s) drove each
selected exercise (`mergeSide()`: unanimous LEFT/RIGHT → that side,
anything mixed or unmarked → BILATERAL, the safe default) and stores it
on `CorrectivePlanItem.side`. Rather than rewriting the shared
`Exercise.description`/`execution` text per client (fragile — 70+ exist-
ing exercises' free text was never written with `{SIDE}` placeholders,
so pattern-matching bilateral phrasing out of it could quietly produce a
wrong instruction), `src/lib/corrective/sideInstructions.ts` composes the
client-facing instruction at render time from structured data: a
"nur links"/"nur rechts"/"beidseitig" badge, the dosage text, and — for
unilateral items — an explanatory sentence naming which finding drove the
restriction. Used in both `/scans`' generated-plan display and
`/training`'s exercise checklist.

**3. Trainings- & Fortschrittsdokumentation (`/training`, `/progress`,
`src/lib/trainingLog.ts`)** — "Diesen Plan als Trainingssitzung starten"
on `/scans` turns a generated plan into a `TrainingSession` (see the new
Prisma models: `TrainingSession`, `TrainingSessionExercise`,
`SessionQuestionnaire`) and opens `/training`, which walks through:
- a **pre-training questionnaire** (Schmerzlevel, Schmerzort, Energie,
  Schlafqualität, Stress, Trainingsbereitschaft),
- the **exercise checklist**, side-aware per above, where the coach/
  client records what was actually done (Ist-Wiederholungen, Schmerz
  während der Übung, Notizen) per exercise,
- a **post-training questionnaire** (RPE, Schmerz während/nach der
  Sitzung, Schwierigkeit, Zufriedenheit, "würde wiederholen").

`/progress` then shows, per client: session count/adherence stat tiles, a
Schmerzlevel- and RPE-Trend over time (simple single-hue line charts —
color/spacing chosen per the project's dataviz skill), and a full session
table (same data as the charts, so nothing is chart-only).

**Why localStorage instead of Prisma for this part specifically**: every
other Phase 1 page (`/exercises`, `/scans`) already reads static seed
JSON and keeps state client-side because `DATABASE_URL` isn't connected
yet — but training/progress data is the one place plain `useState`
genuinely breaks the feature, since "progress over time" requires
surviving a page reload between sessions. `src/lib/trainingLog.ts` uses
the browser's `localStorage` as a stopgap, with record shapes that match
the Prisma model field names 1:1 so swapping in real
`prisma.trainingSession.*` calls later is a mechanical migration, not a
redesign. This means training history currently lives per-browser, not
per-account — connecting the database (see "What's next" below) replaces
this properly.

## SmartMotionApproach production pipeline (draft exercises)

The exercise library is being expanded with 45 additional exercises to
better cover Overhead Squat Assessment sign clusters and subsystems not
yet fully addressed (LED, LPHCD, UBD, Asymmetrical Weight Shift, ISS,
POS, AOS, DLS). These are being produced in 15 "production rounds" of 3
exercises each, in a fixed priority order — the full plan, including all
20 required spec fields per exercise (target muscles, OHS signs,
coaching cues, regressions/progressions, etc.) and the priority order
for all 15 rounds, is saved in `claude/SmartMotionApproach_Produktionsplan.md`
in the Claude Project so it survives across sessions.

**Why these exercises are in the database but not visible in the app
yet**: each exercise is fully specified before video production even
starts, so nothing gets forgotten between planning and filming — but
showing a video-less exercise to a client (or letting the `/scans`
Corrective Exercise plan generator recommend one) would be broken. So:

- `Exercise.isPublished` (default `true`) is `false` for every exercise
  awaiting video. The public `/exercises` library and the `/scans` plan
  generator both read from `prisma/seed-data/exercises.json` +
  `corrective-exercises.json` only, so draft exercises never surface
  there regardless of the flag — the flag exists for when these move to
  a real Prisma-backed query (see the TODOs in `page.tsx`/`scans/page.tsx`).
- `/exercises/drafts` is an internal, coach-only view (not yet behind
  auth — same caveat as the rest of this Phase 1 scaffold) that lists
  every draft exercise grouped by production round, with its full spec.
- New fields on `Exercise` support the spec: `nameEn`, `bibCategory`
  (`BI_ORIGINAL` / `BI_BASED` / `SMA_BASED` — how closely the exercise
  follows a verified Brookbush Institute technique vs. an adapted or
  original SmartMotionApproach implementation), `level` (`LEVEL_1` =
  MoveFlexRelax/MoveFlexStretch, `LEVEL_2` = MoveSyncActivation/
  MoveSyncIntegration), `productionRound`, `relevantSigns`,
  `relevantSignClusters`, `relevantSubsystems`, `rationale`,
  `startPosition`, `execution`, `coachingCues`, `commonMistakes`,
  `dosageNote`, `regressionNote`, `progressionNote`,
  `contraindicationNote`, and a self-relation
  (`similarExistingExercise`) linking a draft to the closest exercise
  already in the library, with `similarExistingDifference` explaining
  why the new one is still needed.

**Brookbush verification caveat**: `bibCategory` should ideally be
confirmed against the live Brookbush Institute course content before an
exercise is marked `BI_ORIGINAL`. That live check hasn't been possible
yet in this environment (see the open Chrome-extension-connection issue
noted in the Claude Project doc), so any exercise whose category was
uncertain has been conservatively labeled `BI_BASED` instead of
`BI_ORIGINAL` until it can be verified — re-check these once browser
access is available.

**Status**: Production Round 1 (3 of 45 exercises — ankle dorsiflexion
mobilization, tibialis posterior activation, tibial internal rotation
control) is done and seeded as drafts. Rounds 2-15 (42 exercises) are
specified in the plan doc but not yet built out.

## What's next (in build order)

1. **Run `npx prisma generate` + `npx prisma migrate dev` on a real
   machine** (see "Getting started locally") — this sandbox couldn't do
   it, so it's the one remaining step before anything Prisma-backed
   (auth, `/clients`, `/portal`) actually runs.
2. **Connect Calendly**: create the event types (single session, package
   redemption), get an API key + webhook signing key, wire the embed in
   `src/app/page.tsx` and verify signatures in the webhook route.
3. **Connect Stripe**: single-session payment, Stripe Checkout for
   packages/digital products, verify webhook signatures, wire the credits
   ledger logic described in the concept doc (section 4).
4. **Cap exercises per plan phase** — see the "Known limitation" note
   under "Automatischer Scan-zu-Plan-Workflow" above; a dense scan can
   currently generate an unrealistically long single-phase exercise list.
5. **Coach authentication** — `/clients`, `/scans` upload and
   `/api/clients/[id]/scans` have no login yet (single-operator
   assumption, see "Athletik Movement" above); add it once more than one
   coach needs access.
6. **Real object storage for scan uploads** — both `/api/scans/upload`
   and `/api/clients/[id]/scans` currently write to the local filesystem
   (`.uploads/scans/`), which does not survive on Vercel's serverless
   functions; swap for Vercel Blob/Supabase Storage/S3 before deploying.
7. **Real email sending** — `src/lib/email.ts` currently just logs
   (see the "Dev-Modus" note above); wire it to Resend/Postmark once
   `RESEND_API_KEY` is set.
8. **Second tenant** (Phase 4): once a second brand is ready, add a
   `Provider` row with its own branding/domain and swap
   `getBranding()`/`getActiveProvider()` for a real per-request lookup.
9. **SmartMotion-Programme — remaining scope** (see that section above
   for what's already done): a content-integrity check that blocks a
   `Product` from `isPublished: true` while any of its `ProgramBlock`s
   references an unpublished `Exercise`; an admin panel for price/
   published-status/content-status editing (spec requirement #5); the
   client-facing `/programme` browse + purchase pages and the
   `ProductAssessment` UI (week 0/4/8/12 test entry + progress view);
   wiring purchases to Stripe (`accessDays`-based unlock, matching the
   existing `Order`/credits pattern); and, when there's appetite, the
   other 12 products' full week-by-week session data (currently
   catalog-only, `isPublished: false`) plus the 45-exercise
   SmartMotionApproach production pipeline these programs ultimately
   depend on for video/coaching-cue content (see that section below —
   only 3 of 45 are fully specified so far).

## Deployment

This is a standard Next.js app — deploys cleanly to
[Vercel](https://vercel.com) (recommended, per the concept doc's tech
stack rationale: native multi-domain support for the white-label setup).

## A note on where this code lives

This scaffold was built in an ephemeral cloud workspace and delivered to
you as a download. To keep working on it across sessions (with me or
otherwise), push it to your own Git repository (e.g. GitHub) as the next
step — that also gives you the deploy hook for Vercel.
