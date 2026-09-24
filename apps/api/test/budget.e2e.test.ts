import { addDays, localDate } from "@coinfidant/engine";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ScopedDb } from "../src/db/db.module";
import { cycles } from "../src/db/schema";
import { as, createTestApp, type Session, SETUP, type TestApp } from "./harness";

const NGN = (n: number) => n * 100;
const today = () => localDate(new Date(), "Africa/Lagos");

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

/** A fresh user whose cycle started `daysAgo` days ago. */
async function freshBudget(daysAgo = 10) {
  const who = await t.signIn();
  const api = as(t, who);
  const res = await api.post("/api/budget/setup", { ...SETUP, lastSalaryOn: addDays(today(), -daysAgo) });
  expect(res.status).toBe(201);
  const food = res.body.budget.categories.find((c: { slug: string }) => c.slug === "food").id as string;
  return { who, api, food, budget: res.body.budget };
}

const snapshot = async (api: ReturnType<typeof as>) => (await api.get("/api/today")).body.snapshot;

describe("setup", () => {
  it("creates the budget, salary income, default categories and first cycle", async () => {
    const { api, budget } = await freshBudget();
    expect(budget.incomes).toEqual([expect.objectContaining({ name: "Salary", amount: SETUP.salary, kind: "salary" })]);
    expect(budget.categories.map((c: { slug: string }) => c.slug)).toEqual([
      "food",
      "groceries",
      "transport",
      "shopping",
      "fun",
      "health",
      "home",
      "other",
    ]);
    const s = await snapshot(api);
    expect(s.cycle.start).toBe(addDays(today(), -10));
    expect(s.plan).toMatchObject({
      salary: SETUP.salary,
      bills: NGN(60_000),
      savingsPlanned: NGN(40_000),
      flexible: NGN(300_000),
    });
  });

  it("re-running setup edits the plan without a second budget or cycle", async () => {
    const { who, api } = await freshBudget();
    const res = await api.post("/api/budget/setup", { ...SETUP, salary: NGN(500_000), bills: [] });
    expect(res.status).toBe(201);
    const s = await snapshot(api);
    expect(s.plan).toMatchObject({ salary: NGN(500_000), bills: 0, flexible: NGN(450_000) });
    const open = await t.app
      .get(ScopedDb)
      .run(who.user.id, (tx) => tx.select().from(cycles).where(eq(cycles.status, "open")));
    expect(open).toHaveLength(1);
  });

  it("GET /budget 404s before setup", async () => {
    const who = await t.signIn();
    expect((await as(t, who).get("/api/budget")).status).toBe(404);
  });
});

describe("logging", () => {
  it("returns the updated numbers after every spend", async () => {
    const { api, food } = await freshBudget();
    const before = await snapshot(api);
    const res = await api.post("/api/transactions", { amount: NGN(2_500), categoryId: food });
    expect(res.status).toBe(201);
    const after = res.body.today.snapshot;
    expect(after.today.spentToday).toBe(before.today.spentToday + NGN(2_500));
    expect(after.today.spendToday).toBe(before.today.spendToday - NGN(2_500));
    expect(res.body.today.transactions.at(-1)).toMatchObject({ amount: NGN(2_500), category: { slug: "food" } });
  });

  it("accepts back-dated entries inside the cycle and refunds", async () => {
    const { api, food } = await freshBudget();
    const yesterday = addDays(today(), -1);
    const res = await api.post("/api/transactions", { amount: NGN(4_000), categoryId: food, date: yesterday });
    expect(res.body.transaction.localDate).toBe(yesterday);
    const refund = await api.post("/api/transactions", { amount: NGN(1_000), categoryId: food, type: "refund" });
    expect(refund.body.today.snapshot.today.spentToday).toBe(NGN(-1_000));
  });

  it("rejects dates outside the open cycle", async () => {
    const { api, food } = await freshBudget(3);
    expect(
      (await api.post("/api/transactions", { amount: 1, categoryId: food, date: addDays(today(), -4) })).body,
    ).toEqual({
      error: "date_outside_cycle",
    });
    expect(
      (await api.post("/api/transactions", { amount: 1, categoryId: food, date: addDays(today(), 1) })).status,
    ).toBe(400);
  });

  it("edits and deletes transactions", async () => {
    const { api, food } = await freshBudget();
    const { body } = await api.post("/api/transactions", { amount: NGN(1_000), categoryId: food });
    const edited = await api.patch(`/api/transactions/${body.transaction.id}`, { amount: NGN(3_000), note: "lunch" });
    expect(edited.body.snapshot.today.spentToday).toBe(NGN(3_000));
    const gone = await api.del(`/api/transactions/${body.transaction.id}`);
    expect(gone.body.today.snapshot.today.spentToday).toBe(0);
  });
});

describe("plan items move the numbers", () => {
  it("a sinking fund comes off the top", async () => {
    const { api } = await freshBudget();
    const res = await api.post("/api/sinking-funds", {
      name: "Rent 2027",
      target: NGN(600_000),
      dueDate: "2027-03-15",
    });
    expect(res.status).toBe(201);
    const s = await snapshot(api);
    const setAside = s.plan.sinking[0].setAside;
    expect(setAside).toBeGreaterThan(0);
    expect(s.plan.flexible).toBe(NGN(300_000) - setAside);
  });

  it("a debt repayment is taken from savings first", async () => {
    const { api } = await freshBudget();
    await api.post("/api/debts", {
      name: "Loan",
      creditor: "Bank",
      amountLeft: NGN(100_000),
      plan: { kind: "installments", perCycle: NGN(15_000) },
    });
    const s = await snapshot(api);
    expect(s.plan).toMatchObject({ savingsPlanned: NGN(25_000), flexible: NGN(300_000) });
    expect(s.plan.debts[0]).toMatchObject({ due: NGN(15_000), fromSavings: NGN(15_000), fromFlexible: 0 });
  });

  it("commitments budget their minimum", async () => {
    const { api } = await freshBudget();
    await api.post("/api/commitments", { name: "Sister", min: NGN(20_000), ideal: NGN(50_000) });
    expect((await snapshot(api)).plan.flexible).toBe(NGN(280_000));
  });

  it("validates plan items", async () => {
    const { api } = await freshBudget();
    expect((await api.post("/api/commitments", { name: "x", min: 5, ideal: 1 })).status).toBe(400);
    expect(
      (await api.post("/api/debts", { name: "x", creditor: "y", amountLeft: 1, plan: { kind: "oneOff" } })).status,
    ).toBe(400);
    expect((await api.patch("/api/bills/00000000-0000-4000-8000-000000000000", { amount: 1 })).status).toBe(404);
    expect((await api.patch("/api/bills/00000000-0000-4000-8000-000000000000", {})).status).toBe(400);
  });

  it("settings change the engine's inputs", async () => {
    const { api } = await freshBudget();
    const res = await api.patch("/api/budget/settings", { savingsPercent: 20, floorPercent: 60 });
    expect(res.body.budget).toMatchObject({ savingsPercent: 20, floorPercent: 60 });
    expect((await snapshot(api)).plan.flexible).toBe(NGN(260_000));
  });
});

describe("categories", () => {
  it("renames, archives and caps at 12 active", async () => {
    const { api, food } = await freshBudget();
    const renamed = await api.patch(`/api/categories/${food}`, { name: "Chop" });
    expect(renamed.body.category).toMatchObject({ name: "Chop", slug: "food" });

    for (const name of ["A", "B", "C", "D"]) {
      expect((await api.post("/api/categories", { name, emoji: "🧪" })).status).toBe(201);
    }
    expect((await api.post("/api/categories", { name: "E", emoji: "🧪" })).body).toEqual({ error: "category_limit" });

    expect((await api.post(`/api/categories/${food}/archive`)).status).toBe(201);
    expect((await api.post("/api/transactions", { amount: 1, categoryId: food })).body).toEqual({
      error: "unknown_category",
    });
    const today = (await api.get("/api/today")).body;
    expect(today.categories.some((c: { id: string }) => c.id === food)).toBe(false);
  });
});

describe("salary received", () => {
  it("closes the open cycle, rolls debts and funds forward, and opens the next", async () => {
    const { who, api, food } = await freshBudget(20);
    const debt = await api.post("/api/debts", {
      name: "Loan",
      creditor: "Bank",
      amountLeft: NGN(100_000),
      plan: { kind: "installments", perCycle: NGN(20_000) },
    });
    const debtId = debt.body.item.id;
    await api.post(`/api/debts/${debtId}/payments`, { amount: NGN(20_000) });
    await api.post("/api/sinking-funds", { name: "Fees", target: NGN(120_000), dueDate: "2027-06-01" });
    await api.post("/api/transactions", { amount: NGN(5_000), categoryId: food, date: addDays(today(), -5) });

    const res = await api.post("/api/cycles/salary", { amount: NGN(410_000) });
    expect(res.status).toBe(201);
    const { closed } = res.body;
    expect(closed.cycle).toMatchObject({ start: addDays(today(), -20), end: addDays(today(), -1) });
    expect(closed.spent).toBe(NGN(5_000));
    expect(closed.debts).toEqual([{ id: debtId, amountLeft: NGN(80_000), unpaid: 0 }]);
    expect(closed.engineVersion).toBe("1.0.0");
    expect(res.body.today.cycle).toMatchObject({ startDate: today(), salary: NGN(410_000) });

    const budget = (await api.get("/api/budget")).body.budget;
    expect(budget.debts[0].amountLeft).toBe(NGN(80_000));
    expect(budget.sinkingFunds[0].saved).toBe(closed.sinkingFunds[0].saved);
    expect(budget.sinkingFunds[0].saved).toBeGreaterThan(0);

    const stored = await t.app.get(ScopedDb).run(who.user.id, (tx) =>
      tx
        .select()
        .from(cycles)
        .where(and(eq(cycles.status, "closed"))),
    );
    expect(stored).toHaveLength(1);
    expect(stored[0]!.snapshot).toMatchObject({ savingsRateBp: closed.savingsRateBp });
  });

  it("marking the same day twice is a no-op", async () => {
    const { api } = await freshBudget();
    await api.post("/api/cycles/salary", {});
    const again = await api.post("/api/cycles/salary", {});
    expect(again.status).toBe(201);
    expect(again.body.closed).toBeNull();
    expect(again.body.today.cycle.startDate).toBe(today());
  });

  it("refuses dates in the future or before the open cycle", async () => {
    const { api } = await freshBudget(5);
    expect((await api.post("/api/cycles/salary", { receivedOn: addDays(today(), 1) })).body).toEqual({
      error: "future_date",
    });
    expect((await api.post("/api/cycles/salary", { receivedOn: addDays(today(), -6) })).body).toEqual({
      error: "before_open_cycle",
    });
  });

  it("closed-cycle transactions can't be edited yet", async () => {
    const { api, food } = await freshBudget(5);
    const { body } = await api.post("/api/transactions", { amount: 1, categoryId: food, date: addDays(today(), -2) });
    await api.post("/api/cycles/salary", {});
    expect((await api.del(`/api/transactions/${body.transaction.id}`)).body).toEqual({ error: "cycle_closed" });
  });
});

describe("sweep choices", () => {
  it("records where a week's leftover goes", async () => {
    const { api } = await freshBudget(20);
    const debt = await api.post("/api/debts", {
      name: "Loan",
      creditor: "Bank",
      amountLeft: NGN(100_000),
      plan: { kind: "installments", perCycle: NGN(10_000) },
    });
    const res = await api.put("/api/cycles/current/sweeps/0", { debtId: debt.body.item.id });
    expect(res.status).toBe(200);
    expect(res.body.snapshot.savings.sweptToDebts).toEqual([{ debtId: debt.body.item.id, amount: expect.any(Number) }]);
    expect(
      (await api.put("/api/cycles/current/sweeps/0", { debtId: null })).body.snapshot.savings.sweptToDebts,
    ).toEqual([]);
  });
});

export type { Session };
