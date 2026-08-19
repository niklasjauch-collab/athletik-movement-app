// Coach/admin (COACH_ADMIN role) authentication — deliberately a
// separate cookie/table from src/lib/auth.ts's client (CUSTOMER) auth,
// see AdminUser's doc comment in schema.prisma for why. Otherwise an
// exact mirror of auth.ts's proven pattern: hash-only-at-rest session
// tokens, getCurrentAdmin() never throws, redirectIfNotAdmin() is the
// one guard every /admin/* route relies on (see src/app/admin/layout.tsx).
//
// SANDBOX-ONLY, see the top of src/lib/db.ts for why: this file imports
// the `AdminUser` type from @prisma/client, which isn't generated in this
// environment. Remove the two lines below once `npx prisma generate` can
// run somewhere with normal internet access.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { randomBytes, createHash } from "crypto";
import { prisma } from "./db";
import { hashPassword, verifyPassword, normalizeEmail } from "./auth";
import type { AdminUser } from "@prisma/client";

export { hashPassword, verifyPassword, normalizeEmail };

const ADMIN_SESSION_COOKIE = "admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const RESET_TOKEN_TTL_MS = 1000 * 60 * 60; // 1 hour

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createAdminSession(adminUserId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.adminSession.create({
    data: { adminUserId, tokenHash: hashToken(token), expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (token) {
    await prisma.adminSession.deleteMany({ where: { tokenHash: hashToken(token) } }).catch((err) => {
      console.error("[adminAuth] failed to delete session row on logout", err);
    });
  }
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}

/** Same never-throws contract as auth.ts's getCurrentClient(). */
export const getCurrentAdmin = cache(async (): Promise<AdminUser | null> => {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
    if (!token) return null;

    const session = await prisma.adminSession.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { adminUser: true },
    });
    if (!session) return null;
    if (session.expiresAt < new Date()) {
      await prisma.adminSession.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    return session.adminUser;
  } catch (err) {
    console.error("[adminAuth] getCurrentAdmin failed", err);
    return null;
  }
});

/** The one guard every /admin/* route relies on (called from
 * src/app/admin/layout.tsx, which covers the whole subtree) — redirects
 * to /admin/login if there's no valid AdminUser session. This is the
 * fix for the previous, weaker guard (redirectIfClientLoggedIn, which
 * only blocked logged-in customers but left coach routes open to
 * anyone else, including anonymous visitors). */
export async function redirectIfNotAdmin(): Promise<AdminUser> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

export class AdminAuthRequiredError extends Error {
  constructor() {
    super("Nicht als Coach angemeldet.");
  }
}

/** For API routes (which can't redirect() the way a page can) that must
 * only ever be called by a logged-in coach — scan upload/analysis,
 * exercise/plan management, etc. Returns 401 JSON via the caller's own
 * catch block rather than a page redirect. This is the fix for the
 * previously-open API routes (see their old "TODO: require coach auth
 * once real auth exists" comments) — those endpoints could previously be
 * called by anyone, including an unauthenticated request. */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new AdminAuthRequiredError();
  return admin;
}

export interface CreateAdminPasswordResetResult {
  token: string;
  expiresAt: Date;
}

export async function createAdminPasswordResetToken(adminUserId: string): Promise<CreateAdminPasswordResetResult> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await prisma.adminPasswordResetToken.create({
    data: { adminUserId, tokenHash: hashToken(token), expiresAt },
  });
  return { token, expiresAt };
}

export interface ConsumeAdminResetResult {
  ok: boolean;
  error?: string;
}

export async function consumeAdminPasswordResetToken(token: string, newPassword: string): Promise<ConsumeAdminResetResult> {
  const record = await prisma.adminPasswordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record) return { ok: false, error: "Dieser Link ist ungültig." };
  if (record.usedAt) return { ok: false, error: "Dieser Link wurde bereits verwendet." };
  if (record.expiresAt < new Date()) return { ok: false, error: "Dieser Link ist abgelaufen. Bitte fordere einen neuen an." };

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.adminUser.update({ where: { id: record.adminUserId }, data: { passwordHash } }),
    prisma.adminPasswordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.adminSession.deleteMany({ where: { adminUserId: record.adminUserId } }),
  ]);

  return { ok: true };
}
