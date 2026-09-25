import { addDays, localDate } from "@coinfidant/engine";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createTestApp, type TestApp } from "./harness";

const NGN = (n: number) => n * 100;
const today = () => localDate(new Date(), "Africa/Lagos");

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

const onboard = async (o: object = {}) => {
  const api = as(t, await t.signIn());
  const res = await api.post("/api/onboarding", {
    personality: "cheeky",
    timezone: "Africa/Lagos",
    salary: NGN(400_000),
    expectedPayday: 31,
    lastSalaryOn: addDays(today(), -20),
    bills: [],
    sinkingFunds: [],
    debts: [],
    goals: [],
    commitments: [{ name: "Sister", min: NGN(20_000), ideal: NGN(50_000) }],
    everydayEstimate: NGN(100_000),
    discovery: false,
    leakCategories: [],
    overspendTimes: ["afterPayday"],
    checkinMethod: "app",
    leftoverDefault: "savings",
    ...o,
  });
  expect(res.status).toBe(201);
  return { api, today: res.body };
};

describe("payday mode", () => {
  it("shows once per payday for Payday-mode users", async () => {
    const { api, today: first } = await onboard();
    expect(first.budget.paydayMode).toBe(true);
    expect(first.cycle.paydaySeenAt).not.toBeNull();

    const paid = await api.post("/api/cycles/salary", {});
    expect(paid.body.today.cycle.paydaySeenAt).toBeNull();

    expect((await api.post("/api/cycles/current/payday-seen")).status).toBe(204);
    const after = (await api.get("/api/today")).body;
    expect(after.cycle.paydaySeenAt).not.toBeNull();
    expect((await api.post("/api/cycles/current/payday-seen")).status).toBe(204);
  });

  it("skips the flow when Payday mode is off", async () => {
    const { api } = await onboard({ overspendTimes: [] });
    const paid = await api.post("/api/cycles/salary", {});
    expect(paid.body.today.cycle.paydaySeenAt).not.toBeNull();
  });
});

describe("ideal top-ups", () => {
  it("accepting a top-up budgets it this cycle; 0 removes it", async () => {
    const { api, today: first } = await onboard();
    const sisterId = first.snapshot.plan.commitments[0].id;
    const before = first.snapshot.plan.flexible;

    const up = await api.put(`/api/cycles/current/top-ups/${sisterId}`, { amount: NGN(30_000) });
    expect(up.status).toBe(200);
    expect(up.body.snapshot.plan.commitments[0].amount).toBe(NGN(50_000));
    expect(up.body.snapshot.plan.flexible).toBe(before - NGN(30_000));
    expect(up.body.topUps).toEqual([{ id: sisterId, amount: NGN(30_000) }]);

    const off = await api.put(`/api/cycles/current/top-ups/${sisterId}`, { amount: 0 });
    expect(off.body.snapshot.plan.flexible).toBe(before);
  });

  it("refuses more than the gap to the ideal", async () => {
    const { api, today: first } = await onboard();
    const res = await api.put(`/api/cycles/current/top-ups/${first.snapshot.plan.commitments[0].id}`, {
      amount: NGN(30_001),
    });
    expect(res.body).toEqual({ error: "above_ideal", max: NGN(30_000) });
  });

  it("only applies to flexible debts and your own items", async () => {
    const { api, today: first } = await onboard({
      debts: [
        {
          name: "Loan",
          creditor: "Bank",
          amountLeft: NGN(50_000),
          plan: { kind: "installments", perCycle: NGN(5_000) },
        },
      ],
    });
    const loanId = first.snapshot.plan.debts[0].id;
    expect((await api.put(`/api/cycles/current/top-ups/${loanId}`, { amount: 1 })).status).toBe(404);

    const other = await onboard();
    const theirs = first.snapshot.plan.commitments[0].id;
    expect((await other.api.put(`/api/cycles/current/top-ups/${theirs}`, { amount: 1 })).status).toBe(404);
  });

  it("covers flexible debts up to the ideal or what's left", async () => {
    const { api, today: first } = await onboard({
      commitments: [],
      debts: [
        {
          name: "Uncle",
          creditor: "Family",
          amountLeft: NGN(25_000),
          plan: { kind: "flexible", min: NGN(5_000), ideal: NGN(40_000) },
        },
      ],
    });
    const id = first.snapshot.plan.debts[0].id;
    expect((await api.put(`/api/cycles/current/top-ups/${id}`, { amount: NGN(21_000) })).body.max).toBe(NGN(20_000));
    const ok = await api.put(`/api/cycles/current/top-ups/${id}`, { amount: NGN(20_000) });
    expect(ok.body.snapshot.plan.debts[0].due).toBe(NGN(25_000));
  });
});

describe("discovery cycle", () => {
  it("tracks progress, then learns the everyday estimate at close", async () => {
    const { api, today: first } = await onboard({ discovery: true, everydayEstimate: null, overspendTimes: [] });
    expect(first.discovery).toMatchObject({ day: 21, confidence: expect.any(Number), categories: [] });

    const cat = (slug: string) => first.categories.find((c: { slug: string }) => c.slug === slug).id;
    for (const [daysAgo, amount, slug] of [
      [15, 3_000, "food"],
      [12, 2_500, "food"],
      [3, 4_500, "food"],
      [5, 7_000, "transport"],
    ] as const) {
      await api.post("/api/transactions", {
        amount: NGN(amount),
        categoryId: cat(slug),
        date: addDays(today(), -daysAgo),
      });
    }
    const mid = (await api.get("/api/today")).body.discovery;
    expect(mid.categories[0]).toMatchObject({
      categoryId: cat("food"),
      spent: NGN(10_000),
      monthly: expect.any(Number),
    });
    expect(mid.categories[1]).toMatchObject({ categoryId: cat("transport"), monthly: null });

    const paid = await api.post("/api/cycles/salary", {});
    expect(paid.body.learned).toEqual({
      total: NGN(17_000),
      categories: [
        { categoryId: cat("food"), name: "Food", emoji: "🍜", monthly: NGN(10_000) },
        { categoryId: cat("transport"), name: "Transport", emoji: "🚌", monthly: NGN(7_000) },
      ],
    });
    expect(paid.body.today.budget).toMatchObject({ discovery: false, everydayEstimate: NGN(17_000) });
    expect(paid.body.today.discovery).toBeNull();
  });

  it("a discovery cycle with nothing logged ends without inventing an estimate", async () => {
    const { api } = await onboard({ discovery: true, everydayEstimate: null, overspendTimes: [] });
    const paid = await api.post("/api/cycles/salary", {});
    expect(paid.body.learned).toEqual({ total: 0, categories: [] });
    expect(paid.body.today.budget).toMatchObject({ discovery: false, everydayEstimate: null });
  });
});
