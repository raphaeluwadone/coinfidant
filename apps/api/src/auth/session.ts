import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { db } from "../db/client";
import { sessions, users, type User } from "../db/schema";

const COOKIE = "cf_session";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const isProd = process.env.NODE_ENV === "production";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function startSession(c: Context, userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MS);
  await db.insert(sessions).values({ tokenHash: hash(token), userId, expiresAt });
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "Lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession(c: Context) {
  const token = getCookie(c, COOKIE);
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hash(token)));
  deleteCookie(c, COOKIE, { path: "/" });
}

export async function pruneExpiredSessions() {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

export type AuthEnv = { Variables: { user: Pick<User, "id" | "email" | "displayName"> } };

export const requireUser = createMiddleware<AuthEnv>(async (c, next) => {
  const token = getCookie(c, COOKIE);
  if (!token) return c.json({ error: "unauthenticated" }, 401);

  const [row] = await db
    .select({ id: users.id, email: users.email, displayName: users.displayName })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hash(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!row) {
    deleteCookie(c, COOKIE, { path: "/" });
    return c.json({ error: "unauthenticated" }, 401);
  }
  c.set("user", row);
  await next();
});
