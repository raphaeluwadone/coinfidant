import { Inject, Injectable } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import type { CookieOptions, Response } from "express";
import { jwtVerify, SignJWT } from "jose";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { CONFIG, type Config } from "../config";
import { DB, type Db } from "../db/db.module";
import { refreshTokens } from "../db/schema";

export const ACCESS_COOKIE = "cf_at";
export const REFRESH_COOKIE = "cf_rt";
const ACCESS_TTL_S = 10 * 60;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// Tabs share one cookie jar, so a tab that lost a refresh race will retry with the new cookie.
const RACE_GRACE_MS = 10_000;
const ISSUER = "coinfidant-api";
const AUDIENCE = "coinfidant-web";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

@Injectable()
export class TokensService {
  private readonly key: Uint8Array;

  constructor(
    @Inject(CONFIG) private readonly config: Config,
    @Inject(DB) private readonly db: Db,
  ) {
    this.key = new TextEncoder().encode(config.JWT_SECRET);
  }

  signAccess(userId: string) {
    return new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TTL_S}s`)
      .sign(this.key);
  }

  async verifyAccess(token: string): Promise<string | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ["HS256"],
      });
      return payload.sub ?? null;
    } catch {
      return null;
    }
  }

  async issueRefresh(userId: string, familyId: string = randomUUID()) {
    const token = randomBytes(32).toString("base64url");
    await this.db.insert(refreshTokens).values({
      tokenHash: hash(token),
      familyId,
      userId,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    });
    return token;
  }

  /** Spends a refresh token and returns its replacement. A second use of a spent token revokes the whole family. */
  async rotate(token: string): Promise<{ userId: string; refresh: string } | null> {
    const now = new Date();
    const [row] = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hash(token)))
      .limit(1);
    if (!row || row.revokedAt || row.expiresAt <= now) return null;

    if (row.rotatedAt) {
      if (now.getTime() - row.rotatedAt.getTime() > RACE_GRACE_MS) await this.revokeFamily(row.familyId);
      return null;
    }

    const claimed = await this.db
      .update(refreshTokens)
      .set({ rotatedAt: now })
      .where(and(eq(refreshTokens.tokenHash, row.tokenHash), isNull(refreshTokens.rotatedAt)))
      .returning({ userId: refreshTokens.userId });
    if (!claimed.length) return null;

    return { userId: row.userId, refresh: await this.issueRefresh(row.userId, row.familyId) };
  }

  async revoke(token: string) {
    const [row] = await this.db
      .select({ familyId: refreshTokens.familyId })
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hash(token)))
      .limit(1);
    if (row) await this.revokeFamily(row.familyId);
  }

  private revokeFamily(familyId: string) {
    return this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
  }

  async setCookies(res: Response, userId: string, refresh: string) {
    res.cookie(ACCESS_COOKIE, await this.signAccess(userId), {
      ...this.base(),
      path: "/api",
      maxAge: ACCESS_TTL_S * 1000,
    });
    res.cookie(REFRESH_COOKIE, refresh, { ...this.base(), path: "/api/auth", maxAge: REFRESH_TTL_MS });
  }

  clearCookies(res: Response) {
    res.clearCookie(ACCESS_COOKIE, { ...this.base(), path: "/api" });
    res.clearCookie(REFRESH_COOKIE, { ...this.base(), path: "/api/auth" });
  }

  private base(): CookieOptions {
    return { httpOnly: true, secure: this.config.NODE_ENV === "production", sameSite: "lax" };
  }
}
