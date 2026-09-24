import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../app";
import { sql } from "../db/client";

const ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:5173";
const emails: string[] = [];

const req = (method: string, path: string, cookie: string, body?: unknown) =>
  app.request(path, {
    method,
    headers: { "Content-Type": "application/json", Origin: ORIGIN, Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function newUser() {
  const email = `test-${randomUUID()}@example.test`;
  emails.push(email);
  const res = await app.request("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ email, password: "correct horse battery" }),
  });
  return res.headers.get("set-cookie")!.split(";")[0]!;
}

const profileBody = {
  salary: 400_000_00,
  savingsPercent: 10,
  payday: 31,
  bills: [
    { name: "Rent", amount: 60_000_00 },
    { name: "Data", amount: 5_000_00 },
  ],
};

let alice = "";
let bob = "";

beforeAll(async () => {
  alice = await newUser();
  bob = await newUser();
});

afterAll(async () => {
  await sql`delete from users where email in ${sql(emails)}`;
  await sql.end();
});

describe("profile", () => {
  it("404s before setup, then saves and replaces bills", async () => {
    expect((await req("GET", "/api/today", alice)).status).toBe(404);

    const put = await req("PUT", "/api/profile", alice, profileBody);
    expect(put.status).toBe(200);
    expect((await put.json()).profile.bills).toHaveLength(2);

    const again = await req("PUT", "/api/profile", alice, { ...profileBody, bills: [{ name: "Rent", amount: 1 }] });
    expect((await again.json()).profile.bills).toEqual([expect.objectContaining({ name: "Rent", amount: 1 })]);
  });

  it("rejects bad input", async () => {
    for (const bad of [
      { ...profileBody, payday: 32 },
      { ...profileBody, savingsPercent: 95 },
      { ...profileBody, salary: -1 },
      { ...profileBody, salary: 10.5 },
      { ...profileBody, timezone: "Mars/Olympus" },
    ]) {
      expect((await req("PUT", "/api/profile", alice, bad)).status).toBe(400);
    }
  });
});

describe("spends", () => {
  it("logs a spend and returns the updated snapshot", async () => {
    await req("PUT", "/api/profile", alice, profileBody);
    const before = await (await req("GET", "/api/today", alice)).json();

    const res = await req("POST", "/api/spends", alice, { amount: 2_500_00, category: "food" });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.today.snapshot.today.spentToday).toBe(before.snapshot.today.spentToday + 2_500_00);
    expect(body.today.snapshot.today.spendToday).toBe(before.snapshot.today.spendToday - 2_500_00);
  });

  it("rejects unknown categories and non-positive amounts", async () => {
    expect((await req("POST", "/api/spends", alice, { amount: 100, category: "yachts" })).status).toBe(400);
    expect((await req("POST", "/api/spends", alice, { amount: 0, category: "food" })).status).toBe(400);
  });

  it("keeps users' spends apart", async () => {
    await req("PUT", "/api/profile", bob, profileBody);
    const { spend } = await (await req("POST", "/api/spends", alice, { amount: 100_00, category: "fun" })).json();

    expect((await req("DELETE", `/api/spends/${spend.id}`, bob)).status).toBe(404);
    const bobToday = await (await req("GET", "/api/today", bob)).json();
    expect(bobToday.spends).toHaveLength(0);

    expect((await req("DELETE", `/api/spends/${spend.id}`, alice)).status).toBe(200);
  });

  it("requires a session", async () => {
    expect((await req("GET", "/api/today", "")).status).toBe(401);
    expect((await req("POST", "/api/spends", "", { amount: 100, category: "food" })).status).toBe(401);
  });
});
