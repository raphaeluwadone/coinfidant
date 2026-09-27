import { addDays, localDate } from "@coinfidant/engine";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createTestApp, type TestApp } from "./harness";

const NGN = (n: number) => n * 100;
const ago = (n: number) => addDays(localDate(new Date(), "Africa/Lagos"), -n);

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

const loan = (name: string, amountLeft: number, aprBp: number | null, hasInterest = true) => ({
  name,
  creditor: "Loan app",
  amountLeft: NGN(amountLeft),
  hasInterest,
  aprBp,
  plan: { kind: "installments", perCycle: NGN(10_000) },
});

async function user(o: object = {}) {
  const api = as(t, await t.signIn());
  const res = await api.post("/api/onboarding", {
    personality: "cheeky",
    timezone: "Africa/Lagos",
    salary: NGN(400_000),
    expectedPayday: 31,
    lastSalaryOn: ago(16),
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
  return { api, first: res.body };
}

describe("funds without a due date", () => {
  it("set aside their fixed amount each cycle", async () => {
    const { first } = await user({
      sinkingFunds: [{ name: "Emergency buffer", target: NGN(300_000), perCycle: NGN(20_000) }],
    });
    expect(first.snapshot.plan.sinking[0].setAside).toBe(NGN(20_000));
  });

  it("need either a due date or an amount per cycle", async () => {
    const { api } = await user();
    expect((await api.post("/api/sinking-funds", { name: "Vague", target: NGN(50_000) })).status).toBe(400);
    expect(
      (await api.post("/api/sinking-funds", { name: "Buffer", target: NGN(50_000), perCycle: NGN(5_000) })).status,
    ).toBe(201);
  });
});

describe("debt APR", () => {
  it("makes the priciest debt the target, and is dropped for interest-free debts", async () => {
    const { api, first } = await user({
      debts: [loan("Cheap", 50_000, 1800), loan("Pricey", 300_000, 3200), loan("Family", 20_000, 4000, false)],
    });
    expect(first.target.name).toBe("Pricey");
    const budget = (await api.get("/api/budget")).body.budget;
    const byName = Object.fromEntries(
      budget.debts.map((d: { name: string; aprBp: number | null }) => [d.name, d.aprBp]),
    );
    expect(byName).toEqual({ Cheap: 1800, Pricey: 3200, Family: null });
  });
});

describe("last cycle's savings rate", () => {
  it("is on Today once a cycle has closed", async () => {
    const { api, first } = await user();
    expect(first.lastRateBp).toBeNull();
    await api.post("/api/cycles/salary", {});
    expect(typeof (await api.get("/api/today")).body.lastRateBp).toBe("number");
  });
});
