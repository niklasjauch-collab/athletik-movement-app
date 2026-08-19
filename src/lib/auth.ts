// Client-facing authentication: password hashing, server-side database
// sessions (cookie holds a random token, only its hash is stored — see
// schema.prisma's Session/PasswordResetToken doc comments), and password
// reset tokens. Follows the Next.js 16 auth guide's Data Access Layer
// pattern (node_modules/next/dist/docs/01-app/02-guides/authentication.md):
// getCurrentClient() is the one place that reads the session cookie, is
// cached per-request via React's cache(), and NEVER throws — callers
// (layout.tsx, /portal, /clients) all treat a null return as "not logged
// in", not as an error.
//
// This is CLIENT (end-customer) auth only. The coach-facing side of the
// app (/clients, /scans upload) has no login yet — see README "Auth" for
// the current single-coach-operator assumption and what's still open.
//
// SANDBOX-ONLY, see the top of src/lib/db.ts for why: this file imports
// the `Client` type from @prisma/client, which isn't generated in this
// environment. Remove the two lines below once `npx prisma generate` can
// run somewhere with normal internet access.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { cookies } from "next/headers";
import { cache } from "react";
import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import type { Client } from "@prisma/client";

const SESSION_COOKIE = "session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const RESET_TOKEN_TTL_MS = 1000 * 60 * 60; // 1 hour — short-lived on purpose
const BCRYPT_ROUNDS = 12;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateToken(): string {
  // 32 random bytes, base64url-encoded — used both as the session cookie
  // value and as the password-reset link token. Only the SHA-256 hash of
  // this ever touches the database (see Session/PasswordResetToken
  // models), so a database leak alone can't be replayed as a valid
  // session or reset link.
  return randomBytes(32).toString("base64url");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Constant-time-ish email comparison isn't actually needed (email isn't a
 * secret), but normalizing consistently here (trim + lowercase) is —
 * every read/write of Client.email must agree on this or "same" emails
 * with different casing would silently create duplicate accounts. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function createSession(clientId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: { clientId, tokenHash: hashToken(token), expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    // Best-effort — if the DB call fails, the cookie is still cleared
    // below so the browser is logged out either way.
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } }).catch((err) => {
      console.error("[auth] failed to delete session row on logout", err);
    });
  }
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Resolves the currently logged-in client from the session cookie, or
 * null if there's no session, or it's invalid/expired. Never throws (any
 * failure — cookie parsing, DB error — is treated as "not logged in")
 * because this is called unconditionally from layout.tsx on every page;
 * a broken DB connection should degrade to "logged out", not a crashed
 * page. Cached with React's cache() so multiple calls within one request
 * (layout + page) only hit the database once.
 */
export const getCurrentClient = cache(async (): Promise<Client | null> => {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { client: true },
    });
    if (!session) return null;
    if (session.expiresAt < new Date()) {
      // Lazily clean up the expired row rather than running a cron for it.
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    return session.client;
  } catch (err) {
    console.error("[auth] getCurrentClient failed", err);
    return null;
  }
});

/** For routes/pages that MUST have a logged-in client (e.g. /portal, and
 * any /api/portal/* route) — redirect-on-null is the caller's job (Server
 * Components use next/navigation's redirect(); API routes return 401),
 * this just centralizes the "throw if missing" check used by API routes. */
export async function requireClient(): Promise<Client> {
  const client = await getCurrentClient();
  if (!client) throw new AuthRequiredError();
  return client;
}

export class AuthRequiredError extends Error {
  constructor() {
    super("Nicht angemeldet.");
  }
}

export interface CreatePasswordResetResult {
  token: string;
  expiresAt: Date;
}

export async function createPasswordResetToken(clientId: string): Promise<CreatePasswordResetResult> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await prisma.passwordResetToken.create({
    data: { clientId, tokenHash: hashToken(token), expiresAt },
  });
  return { token, expiresAt };
}

export interface ConsumeResetResult {
  ok: boolean;
  error?: string;
}

/** Verifies + spends a password-reset token in one step: sets the new
 * password hash, marks the token used (so it can't be replayed), and
 * invalidates every existing session for that client (a stolen session
 * shouldn't survive the legitimate owner resetting their password). */
export async function consumePasswordResetToken(token: string, newPassword: string): Promise<ConsumeResetResult> {
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record) return { ok: false, error: "Dieser Link ist ungültig." };
  if (record.usedAt) return { ok: false, error: "Dieser Link wurde bereits verwendet." };
  if (record.expiresAt < new Date()) return { ok: false, error: "Dieser Link ist abgelaufen. Bitte fordere einen neuen an." };

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.client.update({ where: { id: record.clientId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.session.deleteMany({ where: { clientId: record.clientId } }),
  ]);

  return { ok: true };
}
