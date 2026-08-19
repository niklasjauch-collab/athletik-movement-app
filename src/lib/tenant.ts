// Resolves the single active Provider (tenant) row for this beta phase.
//
// The app is multi-tenant-ready in the schema (every Client/Scan/Plan
// carries a providerId), but only one tenant — Athletik Movement, the
// beta tester — is actually live. Once a second tenant signs up, replace
// this with a real lookup (by custom domain / subdomain, mirroring
// src/lib/branding.ts's TODO) instead of a hardcoded slug.
//
// SANDBOX-ONLY, see the top of src/lib/db.ts for why: this file imports
// the `Provider` type from @prisma/client, which isn't generated in this
// environment. Remove the two lines below once `npx prisma generate` can
// run somewhere with normal internet access.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { cache } from "react";
import { prisma } from "./db";
import type { Provider } from "@prisma/client";

const ACTIVE_PROVIDER_SLUG = "athletik-movement";

/** Cached per-request — every register/login/upload call needs this, and
 * it never changes within a single request. */
export const getActiveProvider = cache(async (): Promise<Provider> => {
  const provider = await prisma.provider.findUnique({ where: { slug: ACTIVE_PROVIDER_SLUG } });
  if (!provider) {
    throw new Error(
      `Provider "${ACTIVE_PROVIDER_SLUG}" wurde nicht gefunden — bitte zuerst "npm run seed" ausführen (legt den Athletik-Movement-Tenant an).`
    );
  }
  return provider;
});
