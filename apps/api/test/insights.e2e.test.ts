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

const loan = (amountLeft: number, perCycle: number, name = "Loan") => ({
  name,
  creditor: "Loan app",
  amountLeft: NGN(amountLeft),
  hasInterest: true,
  plan: { kind: "installments", perCycle: NGN(perCycle) },
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
  const food = res.body.categories.find((c: { slug: string }) => c.slug === "food").id as string;
  return { api, first: res.body, food };
}

describe("phases", () => {
  it("records the first phase without a celebration", async () => {
    const { first } = await user();
    expect(first.phase).toMatchObject({ phase: "build", celebrate: null });
  });

  it("celebrates an advance once, and a step back quietly", async () => {
    const { api, first } = await user({ debts: [loan(20_000, 20_000)] });
    expect(first.phase.phase).toBe("attack");

    const loanId = first.snapshot.plan.debts[0].id;
    await api.post(`/api/debts/${loanId}/payments`, { amount: NGN(20_000) });
    await api.post("/api/cycles/salary", {});
    const after = (await api.get("/api/today")).body;
    expect(after.phase).toMatchObject({ phase: "build", celebrate: { from: "attack", to: "build" } });

    expect((await api.post("/api/phase/celebrated")).status).toBe(204);
    expect((await api.get("/api/today")).body.phase.celebrate).toBeNull();

    await api.post("/api/debts", loan(500_000, 50_000, "New loan"));
    expect((await api.get("/api/today")).body.phase).toMatchObject({ phase: "stabilise", celebrate: null });
  });
});

describe("snowball", () => {
  it("rolls a cleared debt's payment onto the next target", async () => {
    const { api } = await user({ debts: [loan(0, 45_000, "Cleared"), loan(300_000, 10_000, "Next")] });
    const today = (await api.get("/api/today")).body;
    expect(today.target.name).toBe("Next");
    const next = today.snapshot.plan.debts.find((d: { id: string }) => d.id === today.target.id);
    expect(next).toMatchObject({ due: NGN(55_000), rolledIn: NGN(45_000) });
  });
});

describe("weekly sweep offer", () => {
  it("offers last week's leftover until a choice is made", async () => {
    const { api, food } = await user({ debts: [loan(300_000, 10_000, "OPay")] });
    const now = (await api.get("/api/today")).body;
    const prev = now.snapshot.weeks[now.snapshot.today.week.index - 1];
    await api.post("/api/transactions", { amount: NGN(1_000), categoryId: food, date: prev.start });

    const offered = (await api.get("/api/today")).body.sweepOffer;
    expect(offered).toMatchObject({ week: prev.index, target: { name: "OPay" }, goal: null });
    expect(offered.amount).toBeGreaterThan(0);

    await api.put(`/api/cycles/current/sweeps/${prev.index}`, { debtId: null });
    expect((await api.get("/api/today")).body.sweepOffer).toBeNull();
  });

  it("isn't offered without a debt to attack", async () => {
    const { api, food } = await user();
    const now = (await api.get("/api/today")).body;
    const prev = now.snapshot.weeks[now.snapshot.today.week.index - 1];
    await api.post("/api/transactions", { amount: NGN(1_000), categoryId: food, date: prev.start });
    expect((await api.get("/api/today")).body.sweepOffer).toBeNull();
  });
});

describe("insights", () => {
  it("returns 2–3 and rotates on what the viewer saw recently", async () => {
    const { api, food } = await user({ debts: [loan(300_000, 10_000, "OPay")] });
    await api.post("/api/transactions", { amount: NGN(40_000), categoryId: food, date: ago(3) });
    const first = (await api.get("/api/today")).body.insights;
    expect(first.length).toBeGreaterThanOrEqual(2);
    expect(first.length).toBeLessThanOrEqual(3);

    const seen = first.map((x: { key: string }) => x.key).join(",");
    const next = (await api.get(`/api/today?recent=${seen}`)).body.insights;
    expect(next.length).toBeGreaterThanOrEqual(2);
    expect(next.map((x: { key: string }) => x.key)).not.toEqual(first.map((x: { key: string }) => x.key));
  });

  it("rejects unknown insight keys", async () => {
    const { api } = await user();
    expect((await api.get("/api/today?recent=haha,nope")).status).toBe(400);
  });
});
