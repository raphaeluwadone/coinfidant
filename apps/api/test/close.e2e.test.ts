import { addDays, localDate } from "@coinfidant/engine";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createTestApp, type TestApp } from "./harness";

const NGN = (n: number) => n * 100;
const today = () => localDate(new Date(), "Africa/Lagos");
const ago = (n: number) => addDays(today(), -n);

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

/** A user whose first cycle started 40 days ago, with a loan that sweeps take from. */
async function user(o: object = {}) {
  const api = as(t, await t.signIn());
  const res = await api.post("/api/onboarding", {
    personality: "cheeky",
    timezone: "Africa/Lagos",
    salary: NGN(400_000),
    expectedPayday: 31,
    lastSalaryOn: ago(40),
    bills: [],
    sinkingFunds: [],
    debts: [
      {
        name: "Loan",
        creditor: "Bank",
        amountLeft: NGN(500_000),
        plan: { kind: "installments", perCycle: NGN(20_000) },
      },
    ],
    goals: [],
    commitments: [],
    everydayEstimate: NGN(100_000),
    discovery: false,
    leakCategories: [],
    overspendTimes: [],
    checkinMethod: "app",
    leftoverDefault: "savings",
    ...o,
  });
  expect(res.status).toBe(201);
  const food = res.body.categories.find((c: { slug: string }) => c.slug === "food").id as string;
  return { api, food };
}

const spend = (api: ReturnType<typeof as>, food: string, daysAgo: number, amount: number) =>
  api.post("/api/transactions", { amount: NGN(amount), categoryId: food, date: ago(daysAgo) });

describe("cycle close", () => {
  it("returns the closed cycle for the wrap-up, with pending debts", async () => {
    const { api, food } = await user();
    await spend(api, food, 30, 12_000);
    const paid = await api.post("/api/cycles/salary", { receivedOn: ago(20) });
    expect(paid.status).toBe(201);

    const wrap = await api.get(`/api/cycles/${paid.body.closedCycleId}`);
    expect(wrap.body).toMatchObject({ status: "closed", startDate: ago(40), endDate: ago(21) });
    expect(wrap.body.snapshot.spent).toBe(NGN(12_000));
    expect(wrap.body.pendingDebts).toEqual([
      { id: expect.any(String), name: "Loan", amountLeft: NGN(500_000), unpaid: NGN(20_000) },
    ]);
  });

  it("locks the cycle before last when the next salary lands", async () => {
    const { api } = await user();
    const first = await api.post("/api/cycles/salary", { receivedOn: ago(20) });
    await api.post("/api/cycles/salary", {});
    const history = (await api.get("/api/cycles/history")).body.cycles;
    expect(history.map((c: { status: string }) => c.status)).toEqual(["closed", "locked"]);
    expect(history[1].id).toBe(first.body.closedCycleId);
  });
});

describe("adjustment window", () => {
  it("a back-dated entry re-runs the closed cycle's snapshot", async () => {
    const { api, food } = await user();
    const paid = await api.post("/api/cycles/salary", { receivedOn: ago(20) });
    const id = paid.body.closedCycleId;
    const before = (await api.get(`/api/cycles/${id}`)).body.snapshot;

    const added = await spend(api, food, 25, 30_000);
    expect(added.status).toBe(201);
    const after = (await api.get(`/api/cycles/${id}`)).body.snapshot;
    expect(after.spent).toBe(before.spent + NGN(30_000));
    expect(after.savingsRateBp).toBeLessThan(before.savingsRateBp);

    const shown = (await api.get("/api/today")).body.adjustable;
    expect(shown.cycleId).toBe(id);
    expect(shown.transactions.map((x: { id: string }) => x.id)).toContain(added.body.transaction.id);

    await api.del(`/api/transactions/${added.body.transaction.id}`);
    expect((await api.get(`/api/cycles/${id}`)).body.snapshot.spent).toBe(before.spent);
  });

  it("moves debt balances by the change in sweeps, keeping later payments", async () => {
    const { api, food } = await user({ leftoverDefault: "debts" });
    await api.post("/api/cycles/salary", { receivedOn: ago(20) });
    const budget = async () => (await api.get("/api/budget")).body.budget.debts[0];
    const afterClose = (await budget()).amountLeft;
    expect(afterClose).toBeLessThan(NGN(500_000));

    const loanId = (await budget()).id;
    await api.post(`/api/debts/${loanId}/payments`, { amount: NGN(20_000) });

    // Spending in the closed cycle shrinks what was swept onto the loan.
    await spend(api, food, 30, 10_000);
    expect((await budget()).amountLeft).toBe(afterClose + NGN(10_000));
  });

  it("refuses edits to a locked cycle", async () => {
    const { api, food } = await user();
    const old = await spend(api, food, 30, 1_000);
    await api.post("/api/cycles/salary", { receivedOn: ago(20) });
    await api.post("/api/cycles/salary", {});

    expect((await api.del(`/api/transactions/${old.body.transaction.id}`)).body).toEqual({ error: "cycle_locked" });
    expect((await spend(api, food, 30, 1_000)).body).toEqual({ error: "date_outside_cycle" });
    expect((await spend(api, food, 10, 1_000)).status).toBe(201);
  });
});

describe("history", () => {
  it("lists closed cycles newest first with their savings rate", async () => {
    const { api, food } = await user();
    await spend(api, food, 30, 50_000);
    await api.post("/api/cycles/salary", { receivedOn: ago(20) });
    const [cycle] = (await api.get("/api/cycles/history")).body.cycles;
    expect(cycle).toMatchObject({ startDate: ago(40), endDate: ago(21), spent: NGN(50_000) });
    expect(cycle.savingsRateBp).toBe(Math.round((cycle.saved * 10_000) / NGN(400_000)));
  });

  it("keeps other budgets' cycles out", async () => {
    const a = await user();
    const paid = await a.api.post("/api/cycles/salary", { receivedOn: ago(20) });
    const b = await user();
    expect((await b.api.get(`/api/cycles/${paid.body.closedCycleId}`)).status).toBe(404);
    expect((await b.api.get("/api/cycles/history")).body.cycles).toEqual([]);
  });
});
