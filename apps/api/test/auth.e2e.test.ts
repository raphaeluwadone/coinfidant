import { eq } from "drizzle-orm";
import { SignJWT } from "jose";
import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authIdentities, refreshTokens } from "../src/db/schema";
import { cookieValue, createTestApp, ORIGIN, type TestApp } from "./harness";

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

const refresh = (token: string) =>
  t.http().post("/api/auth/refresh").set("Origin", ORIGIN).set("Cookie", `cf_rt=${token}`);

describe("Google sign-in", () => {
  it("redirects to Google with PKCE and a signed state cookie", async () => {
    const res = await t.http().get("/api/auth/google");
    expect(res.status).toBe(302);
    const url = new URL(res.headers.location!);
    expect(url.host).toBe("accounts.google.com");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("state")).toBeTruthy();
    expect(cookieValue(res, "cf_oauth")).toBeTruthy();
  });

  it("rejects a callback whose state doesn't match", async () => {
    const start = await t.http().get("/api/auth/google");
    const oauth = cookieValue(start, "cf_oauth")!;
    const res = await t
      .http()
      .get("/api/auth/google/callback?code=abc&state=forged")
      .set("Cookie", `cf_oauth=${oauth}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${ORIGIN}/login?error=google`);
  });

  it("finds the same account for the same identity", async () => {
    const uid = randomUUID();
    const first = await t.signIn({ providerUserId: uid });
    const again = await t.users.signIn({
      provider: "google",
      providerUserId: uid,
      email: first.user.email,
      emailVerified: true,
      displayName: null,
    });
    expect(again.id).toBe(first.user.id);
  });

  it("links a new identity by verified email, never by unverified", async () => {
    const { user } = await t.signIn();
    const linked = await t.users.signIn({
      provider: "google",
      providerUserId: randomUUID(),
      email: user.email,
      emailVerified: true,
      displayName: null,
    });
    expect(linked.id).toBe(user.id);
    const ids = await t.db.select().from(authIdentities).where(eq(authIdentities.userId, user.id));
    expect(ids).toHaveLength(2);

    await expect(
      t.users.signIn({
        provider: "google",
        providerUserId: randomUUID(),
        email: user.email,
        emailVerified: false,
        displayName: null,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("access tokens", () => {
  it("requires a valid access cookie", async () => {
    const { user, cookie } = await t.signIn();
    expect((await t.http().get("/api/auth/me")).status).toBe(401);
    const me = await t.http().get("/api/auth/me").set("Cookie", cookie);
    expect(me.status).toBe(200);
    expect(me.body.user).toEqual({ id: user.id, email: user.email, displayName: "Tester" });
  });

  it("rejects tokens signed with another key or already expired", async () => {
    const { user } = await t.signIn();
    const forged = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setIssuer("coinfidant-api")
      .setAudience("coinfidant-web")
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode("x".repeat(48)));
    expect((await t.http().get("/api/auth/me").set("Cookie", `cf_at=${forged}`)).status).toBe(401);

    const key = new TextEncoder().encode(process.env.JWT_SECRET!);
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setIssuer("coinfidant-api")
      .setAudience("coinfidant-web")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(key);
    expect((await t.http().get("/api/auth/me").set("Cookie", `cf_at=${expired}`)).status).toBe(401);
  });

  it("sets httpOnly cookies scoped to the API", async () => {
    const { refresh: token } = await t.signIn();
    const res = await refresh(token);
    const set = (res.headers["set-cookie"] as unknown as string[]).join("\n");
    expect(set).toMatch(/cf_at=[^;]+;.*Path=\/api;.*HttpOnly/);
    expect(set).toMatch(/cf_rt=[^;]+;.*Path=\/api\/auth;.*HttpOnly/);
    expect(set).toMatch(/SameSite=Lax/);
  });
});

describe("refresh rotation", () => {
  it("rotates on every use", async () => {
    const { refresh: first } = await t.signIn();
    const res = await refresh(first);
    expect(res.status).toBe(204);
    const second = cookieValue(res, "cf_rt")!;
    expect(second).not.toBe(first);
    expect(cookieValue(res, "cf_at")).toBeTruthy();
    expect((await refresh(second)).status).toBe(204);
  });

  it("tolerates a racing tab without revoking the family", async () => {
    const { refresh: first } = await t.signIn();
    const second = cookieValue(await refresh(first), "cf_rt")!;
    expect((await refresh(first)).status).toBe(401);
    expect((await refresh(second)).status).toBe(204);
  });

  it("revokes the whole family when a spent token is replayed later", async () => {
    const { refresh: first } = await t.signIn();
    const second = cookieValue(await refresh(first), "cf_rt")!;
    // Push the rotation outside the race grace window.
    await t.db
      .update(refreshTokens)
      .set({ rotatedAt: new Date(Date.now() - 60_000) })
      .where(eq(refreshTokens.tokenHash, createHash("sha256").update(first).digest("hex")));

    expect((await refresh(first)).status).toBe(401);
    expect((await refresh(second)).status).toBe(401);
  });

  it("logout revokes the refresh token", async () => {
    const { refresh: token, cookie } = await t.signIn();
    const out = await t.http().post("/api/auth/logout").set("Origin", ORIGIN).set("Cookie", cookie);
    expect(out.status).toBe(204);
    expect((await refresh(token)).status).toBe(401);
  });

  it("rejects unknown tokens", async () => {
    expect((await refresh("not-a-real-token")).status).toBe(401);
    expect((await t.http().post("/api/auth/refresh").set("Origin", ORIGIN)).status).toBe(401);
  });
});

describe("origin check", () => {
  it("rejects state-changing requests from other origins", async () => {
    const { cookie } = await t.signIn();
    const res = await t.http().post("/api/auth/logout").set("Origin", "https://evil.example").set("Cookie", cookie);
    expect(res.status).toBe(403);
    expect((await t.http().post("/api/auth/logout").set("Cookie", cookie)).status).toBe(403);
  });
});
