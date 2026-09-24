import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ScopedDb } from "../src/db/db.module";
import { spends } from "../src/db/schema";
import { createTestApp, ORIGIN, type TestApp } from "./harness";

let t: TestApp;
let alice: Awaited<ReturnType<TestApp["signIn"]>>;
let bob: Awaited<ReturnType<TestApp["signIn"]>>;

const profile = {
  salary: 400_000_00,
  savingsPercent: 10,
  payday: 31,
  bills: [{ name: "Rent", amount: 60_000_00 }],
};

const as = (who: { cookie: string }) => ({
  get: (path: string) => t.http().get(path).set("Cookie", who.cookie),
  put: (path: string, body: unknown) =>
    t
      .http()
      .put(path)
      .set("Origin", ORIGIN)
      .set("Cookie", who.cookie)
      .send(body as object),
  post: (path: string, body: unknown) =>
    t
      .http()
      .post(path)
      .set("Origin", ORIGIN)
      .set("Cookie", who.cookie)
      .send(body as object),
  del: (path: string) => t.http().delete(path).set("Origin", ORIGIN).set("Cookie", who.cookie),
});

beforeAll(async () => {
  t = await createTestApp();
  alice = await t.signIn();
  bob = await t.signIn();
  expect((await as(alice).put("/api/profile", profile)).status).toBe(200);
  expect((await as(bob).put("/api/profile", profile)).status).toBe(200);
});
afterAll(() => t.close());

describe("budget API", () => {
  it("logs a spend and returns the updated day", async () => {
    const before = (await as(alice).get("/api/today")).body;
    const res = await as(alice).post("/api/spends", { amount: 2_500_00, category: "food" });
    expect(res.status).toBe(201);
    expect(res.body.today.snapshot.today.spentToday).toBe(before.snapshot.today.spentToday + 2_500_00);
  });

  it("validates input with the shared contracts", async () => {
    expect((await as(alice).post("/api/spends", { amount: 100, category: "yachts" })).status).toBe(400);
    expect((await as(alice).post("/api/spends", { amount: 0, category: "food" })).status).toBe(400);
    expect((await as(alice).put("/api/profile", { ...profile, payday: 32 })).status).toBe(400);
    expect((await as(alice).put("/api/profile", { ...profile, timezone: "Mars/Olympus" })).status).toBe(400);
    expect((await as(alice).del("/api/spends/not-a-uuid")).status).toBe(400);
  });

  it("requires a session everywhere", async () => {
    expect((await t.http().get("/api/today")).status).toBe(401);
    expect((await t.http().get("/api/profile")).status).toBe(401);
  });
});

describe("user isolation", () => {
  it("never shows or deletes another user's spends through the API", async () => {
    const { body } = await as(alice).post("/api/spends", { amount: 100_00, category: "fun" });
    expect((await as(bob).del(`/api/spends/${body.spend.id}`)).status).toBe(404);
    expect((await as(bob).get("/api/today")).body.spends).toHaveLength(0);
    expect((await as(alice).get("/api/today")).body.spends.map((s: { id: string }) => s.id)).toContain(body.spend.id);
  });

  it("row-level security hides other users' rows even without a user_id filter", async () => {
    const scoped = t.app.get(ScopedDb);
    const bobSees = await scoped.run(bob.user.id, (tx) => tx.select().from(spends));
    expect(bobSees.every((s) => s.userId === bob.user.id)).toBe(true);
    const aliceSees = await scoped.run(alice.user.id, (tx) => tx.select().from(spends));
    expect(aliceSees.length).toBeGreaterThan(0);
  });

  it("row-level security returns nothing when no user is set", async () => {
    const rows = await t.db.select().from(spends);
    expect(rows).toHaveLength(0);
  });

  it("row-level security blocks writing rows for someone else", async () => {
    const scoped = t.app.get(ScopedDb);
    const err = await scoped
      .run(bob.user.id, (tx) =>
        tx.insert(spends).values({ userId: alice.user.id, amount: 1, category: "food", localDate: "2026-09-24" }),
      )
      .then(
        () => null,
        (e: { cause?: { code?: string; message?: string } }) => e.cause,
      );
    expect(err).toMatchObject({ code: "42501", message: expect.stringMatching(/row-level security/) });
  });

  it("the API role can't switch RLS off", async () => {
    await expect(t.db.execute(sql`alter table spends disable row level security`)).rejects.toThrow();
    const [role] = await t.db.execute<{ rolsuper: boolean; rolbypassrls: boolean }>(
      sql`select rolsuper, rolbypassrls from pg_roles where rolname = current_user`,
    );
    expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
  });
});
