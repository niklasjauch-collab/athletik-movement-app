// Prisma client singleton — standard Next.js pattern to avoid exhausting
// the database connection pool from hot-reloaded module instances in dev
// (`next dev` re-evaluates modules on every edit; without caching on
// globalThis, each reload would create a brand new PrismaClient/connection
// pool). In production (`next start`) there's only ever one instance
// anyway, so this is a no-op there.
//
// SANDBOX NOTE (see README "Prisma CLI in diesem Sandbox"): this file
// can't be type-checked in the Claude sandbox this app was built in,
// because the Prisma CLI can't download its query-engine binary here
// (network egress to binaries.prisma.sh is blocked, 403) — so
// @prisma/client has no generated types/exports in this environment and
// `import { PrismaClient } from "@prisma/client"` fails to resolve for
// `tsc`. This is a TYPE-CHECKING-only problem: `next build`'s actual
// bundling step (SWC/webpack) compiles this file fine regardless (the
// @prisma/client PACKAGE exists on disk; only its generated engine/types
// are missing) — confirmed via `npm run build`'s "Compiled successfully"
// step. The `@ts-nocheck` below (and the same one on auth.ts/tenant.ts,
// the only other files that import @prisma/client directly) is what lets
// `next build`'s separate "Running TypeScript" step succeed in THIS
// sandbox. Once `npx prisma generate` can run (i.e. on a machine with
// normal internet access), delete this comment and the @ts-nocheck line —
// the code below is standard, correct Prisma+Next.js and needs no other
// changes.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- SANDBOX-ONLY, see comment above
// @ts-nocheck
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
