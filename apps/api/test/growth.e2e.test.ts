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

async function user(o: object = {}) {
  const api = as(t, await t.signIn());
  const res = await api.post("/api/onboarding", {
    personality: "unhinged",
    timezone: "Africa/Lagos",
    salary: NGN(400_000),
    expectedPayday: 31,
    lastSalaryOn: ago(30),
    bills: [],
    sinkingFunds: [],
    debts: [],
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
  return { api, today: res.body, food: res.body.categories.find((c: { slug: string }) => c.slug === "food").id };
}

describe("growth", () => {
  it("starts empty", async () => {
    const { api } = await user();
    const g = (await api.get("/api/growth")).body;
    expect(g).toMatchObject({ rates: [], trend: "flat", streak: 0 });
    expect(g.badges).toHaveLength(7);
    expect(g.badges.every((b: { earned: boolean }) => !b.earned)).toBe(true);
  });

  it("counts a logging streak and awards the 7-day badge", async () => {
    const { api, food } = await user();
    for (let d = 6; d >= 0; d--)
      await api.post("/api/transactions", { amount: NGN(500), categoryId: food, date: ago(d) });
    const g = (await api.get("/api/growth")).body;
    expect(g.streak).toBe(7);
    expect(g.badges.find((b: { key: string }) => b.key === "streak7").earned).toBe(true);
  });

  it("shows closed cycles' savings rates and celebrates a cleared debt", async () => {
    const { api } = await user({
      debts: [
        {
          name: "Loan",
          creditor: "Bank",
          amountLeft: NGN(20_000),
          plan: { kind: "installments", perCycle: NGN(20_000) },
        },
      ],
    });
    const loan = (await api.get("/api/budget")).body.budget.debts[0].id;
    await api.post(`/api/debts/${loan}/payments`, { amount: NGN(20_000) });
    await api.post("/api/cycles/salary", {});

    const g = (await api.get("/api/growth")).body;
    expect(g.rates).toHaveLength(1);
    expect(g.rates[0].rateBp).toBeGreaterThan(0);
    expect(g.badges.find((b: { key: string }) => b.key === "debtSlayer").earned).toBe(true);
  });
});

describe("stakes override", () => {
  it("is off normally and on when the plan doesn't fit the pay", async () => {
    expect((await user()).today.stakes).toBe(false);
    const squeezed = await user({ bills: [{ name: "Rent", amount: NGN(390_000) }] });
    expect(squeezed.today.stakes).toBe(true);
  });
});
