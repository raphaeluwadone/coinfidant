import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../app";
import { sql } from "../db/client";

const ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:5173";
const email = `test-${randomUUID()}@example.test`;
const password = "correct horse battery";

const post = (path: string, body?: unknown, cookie?: string) =>
  app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN, ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const sessionCookie = (res: Response) => res.headers.get("set-cookie")?.split(";")[0] ?? "";

afterAll(async () => {
  await sql`delete from users where email = ${email}`;
  await sql.end();
});

describe("auth", () => {
  it("signs up, reads /me, logs out", async () => {
    const res = await post("/api/auth/signup", { email, password, displayName: "Tester" });
    expect(res.status).toBe(201);
    const cookie = sessionCookie(res);
    expect(res.headers.get("set-cookie")).toMatch(/HttpOnly/i);

    const me = await app.request("/api/auth/me", { headers: { Cookie: cookie } });
    expect(me.status).toBe(200);
    expect((await me.json()).user.email).toBe(email);

    expect((await post("/api/auth/logout", undefined, cookie)).status).toBe(204);
    const after = await app.request("/api/auth/me", { headers: { Cookie: cookie } });
    expect(after.status).toBe(401);
  });

  it("rejects duplicate email and wrong password", async () => {
    expect((await post("/api/auth/signup", { email, password })).status).toBe(409);
    expect((await post("/api/auth/login", { email, password: "wrong password!!" })).status).toBe(401);
    expect((await post("/api/auth/login", { email: "nobody@example.test", password })).status).toBe(401);
    expect((await post("/api/auth/login", { email: email.toUpperCase(), password })).status).toBe(200);
  });

  it("rejects short passwords and cross-origin posts", async () => {
    expect((await post("/api/auth/signup", { email: "x@example.test", password: "short" })).status).toBe(400);
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
      body: JSON.stringify({ email, password }),
    });
    expect(res.status).toBe(403);
  });
});
