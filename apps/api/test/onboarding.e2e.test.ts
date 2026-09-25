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

const answers = (o: object = {}) => ({
  personality: "unhinged",
  timezone: "Africa/Lagos",
  salary: NGN(1_000_000),
  expectedPayday: 31,
  lastSalaryOn: addDays(today(), -10),
  bills: [
    { name: "Electricity", amount: NGN(40_000) },
    { name: "Data", amount: NGN(100_000) },
  ],
  sinkingFunds: [{ name: "Rent", target: NGN(700_000), dueDate: "2027-03-01" }],
  debts: [
    {
      name: "OPay Loan #2",
      creditor: "OPay",
      amountLeft: NGN(88_000),
      hasInterest: true,
      plan: { kind: "installments", perCycle: NGN(22_000) },
    },
    {
      name: "Uncle Tunde",
      creditor: "Family",
      amountLeft: NGN(150_000),
      plan: { kind: "flexible", min: 0, ideal: NGN(30_000) },
    },
  ],
  goals: [{ name: "Japa fund", emoji: "✈️", target: NGN(2_400_000) }],
  commitments: [{ name: "Sister", min: NGN(20_000), ideal: NGN(50_000) }],
  everydayEstimate: NGN(150_000),
  discovery: false,
  leakCategories: ["food", "transport"],
  overspendTimes: ["afterPayday"],
  checkinMethod: "evening",
  leftoverDefault: "debts",
  ...o,
});

describe("onboarding", () => {
  it("saves every step in one go and returns the first Today", async () => {
    const api = as(t, await t.signIn());
    const res = await api.post("/api/onboarding", answers());
    expect(res.status).toBe(201);
    expect(res.body.cycle.startDate).toBe(addDays(today(), -10));
    expect(res.body.prefs).toMatchObject({
      personality: "unhinged",
      checkinMethod: "evening",
      leakCategories: ["food", "transport"],
      overspendTimes: ["afterPayday"],
    });
    const plan = res.body.snapshot.plan;
    expect(plan.bills).toBe(NGN(140_000));
    expect(plan.commitments).toEqual([{ id: expect.any(String), amount: NGN(20_000) }]);
    expect(plan.debts.map((d: { due: number }) => d.due).sort()).toEqual([0, NGN(22_000)]);

    const { budget } = (await api.get("/api/budget")).body;
    expect(budget).toMatchObject({
      leftoverDefault: "debts",
      paydayMode: true,
      discovery: false,
      everydayEstimate: NGN(150_000),
    });
    expect(budget.goals).toEqual([expect.objectContaining({ name: "Japa fund", emoji: "✈️", target: NGN(2_400_000) })]);
    expect(budget.sinkingFunds).toHaveLength(1);
    expect(budget.debts).toHaveLength(2);
  });

  it("'No idea' starts a discovery cycle with no estimate", async () => {
    const api = as(t, await t.signIn());
    await api.post("/api/onboarding", answers({ discovery: true, everydayEstimate: NGN(1), overspendTimes: [] }));
    const { budget } = (await api.get("/api/budget")).body;
    expect(budget).toMatchObject({ discovery: true, everydayEstimate: null, paydayMode: false });
  });

  it("works with every optional step skipped", async () => {
    const api = as(t, await t.signIn());
    const res = await api.post(
      "/api/onboarding",
      answers({
        bills: [],
        sinkingFunds: [],
        debts: [],
        goals: [],
        commitments: [],
        leakCategories: [],
        overspendTimes: [],
      }),
    );
    expect(res.status).toBe(201);
    expect(res.body.snapshot.plan.flexible).toBe(NGN(900_000));
  });

  it("runs once per account", async () => {
    const api = as(t, await t.signIn());
    expect((await api.post("/api/onboarding", answers())).status).toBe(201);
    expect((await api.post("/api/onboarding", answers())).body).toEqual({ error: "already_onboarded" });
  });

  it("rejects bad dates and leaves nothing behind", async () => {
    const api = as(t, await t.signIn());
    expect((await api.post("/api/onboarding", answers({ lastSalaryOn: addDays(today(), 1) }))).body).toEqual({
      error: "future_date",
    });
    expect((await api.post("/api/onboarding", answers({ lastSalaryOn: addDays(today(), -90) }))).body).toEqual({
      error: "salary_too_old",
    });
    expect((await api.get("/api/budget")).status).toBe(404);
  });

  it("validates the answers", async () => {
    const api = as(t, await t.signIn());
    expect((await api.post("/api/onboarding", answers({ leakCategories: ["crypto"] }))).status).toBe(400);
    expect((await api.post("/api/onboarding", answers({ checkinMethod: "carrier pigeon" }))).status).toBe(400);
    expect(
      (await api.post("/api/onboarding", answers({ commitments: [{ name: "x", min: 10, ideal: 5 }] }))).status,
    ).toBe(400);
    expect((await api.get("/api/budget")).status).toBe(404);
  });
});
