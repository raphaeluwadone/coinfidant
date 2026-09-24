import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ScopedDb } from "../src/db/db.module";
import { budgets, transactions } from "../src/db/schema";
import { as, createTestApp, type Session, SETUP, type TestApp } from "./harness";

let t: TestApp;
let alice: Session;
let bob: Session;
let aliceBudget: { id: string; categories: { id: string }[]; bills: { id: string }[] };

beforeAll(async () => {
  t = await createTestApp();
  alice = await t.signIn();
  bob = await t.signIn();
  aliceBudget = (await as(t, alice).post("/api/budget/setup", SETUP)).body.budget;
  expect((await as(t, bob).post("/api/budget/setup", SETUP)).status).toBe(201);
});
afterAll(() => t.close());

describe("user isolation through the API", () => {
  it("can't read, edit or delete another budget's rows", async () => {
    const food = aliceBudget.categories[0]!.id;
    const { body } = await as(t, alice).post("/api/transactions", { amount: 100_00, categoryId: food });
    const txnId = body.transaction.id;

    expect((await as(t, bob).del(`/api/transactions/${txnId}`)).status).toBe(404);
    expect((await as(t, bob).patch(`/api/transactions/${txnId}`, { amount: 1 })).status).toBe(404);
    expect((await as(t, bob).patch(`/api/bills/${aliceBudget.bills[0]!.id}`, { amount: 1 })).status).toBe(404);
    expect((await as(t, bob).post("/api/transactions", { amount: 1, categoryId: food })).status).toBe(400);
    expect((await as(t, bob).get("/api/today")).body.transactions).toHaveLength(0);
    expect((await as(t, alice).get("/api/today")).body.transactions.map((x: { id: string }) => x.id)).toContain(txnId);
  });

  it("requires a session everywhere", async () => {
    for (const path of ["/api/today", "/api/budget"]) expect((await t.http().get(path)).status).toBe(401);
  });
});

describe("row-level security", () => {
  it("hides other budgets' rows even without a budget_id filter", async () => {
    const scoped = t.app.get(ScopedDb);
    const bobSees = await scoped.run(bob.user.id, (tx) => tx.select().from(transactions));
    expect(bobSees.some((r) => r.budgetId === aliceBudget.id)).toBe(false);
    const bobBudgets = await scoped.run(bob.user.id, (tx) => tx.select().from(budgets));
    expect(bobBudgets).toHaveLength(1);
    expect(bobBudgets[0]!.id).not.toBe(aliceBudget.id);
  });

  it("returns nothing when no user is set", async () => {
    expect(await t.db.select().from(transactions)).toHaveLength(0);
    expect(await t.db.select().from(budgets)).toHaveLength(0);
  });

  it("blocks writing into someone else's budget", async () => {
    const err = await t.app
      .get(ScopedDb)
      .run(bob.user.id, (tx) =>
        tx.insert(transactions).values({
          budgetId: aliceBudget.id,
          amount: 1,
          categoryId: aliceBudget.categories[0]!.id,
          localDate: "2026-09-24",
        }),
      )
      .then(
        () => null,
        (e: { cause?: { code?: string; message?: string } }) => e.cause,
      );
    expect(err).toMatchObject({ code: "42501", message: expect.stringMatching(/row-level security/) });
  });

  it("the API role can't switch it off", async () => {
    await expect(t.db.execute(sql`alter table transactions disable row level security`)).rejects.toThrow();
    const [role] = await t.db.execute<{ rolsuper: boolean; rolbypassrls: boolean }>(
      sql`select rolsuper, rolbypassrls from pg_roles where rolname = current_user`,
    );
    expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
  });
});
