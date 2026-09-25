import { addDays, localDate } from "@coinfidant/engine";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { as, createTestApp, type TestApp } from "./harness";

const NGN = (n: number) => n * 100;
const ago = (n: number) => addDays(localDate(new Date(), "Africa/Lagos"), -n);

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp({ env: { COACH_CYCLE_CAP: "3" } });
});
afterAll(() => t.close());
beforeEach(() => {
  t.coach.available = true;
  t.coach.fail = false;
  t.coach.calls = [];
});

async function user() {
  const who = await t.signIn();
  const api = as(t, who);
  const res = await api.post("/api/onboarding", {
    personality: "unhinged",
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
  });
  expect(res.status).toBe(201);
  const food = res.body.categories.find((c: { slug: string }) => c.slug === "food").id as string;
  return { api, who, food };
}

describe("coach", () => {
  it("stores a read, serves it again, and only calls the model when asked for another", async () => {
    const { api } = await user();
    expect((await api.get("/api/coach")).body).toMatchObject({ available: true, cap: 3, used: 0, current: null });

    const first = await api.post("/api/coach/reviews", {});
    expect(first.status).toBe(200);
    expect(first.body.current.review.verdict.label).toBe("Read 1");
    expect(first.body).toMatchObject({ used: 1, remaining: 2 });

    expect((await api.post("/api/coach/reviews", {})).body.current.review.verdict.label).toBe("Read 1");
    expect(t.coach.calls).toHaveLength(1);

    const again = await api.post("/api/coach/reviews", { fresh: true });
    expect(again.body.current.review.verdict.label).toBe("Read 2");
    expect(again.body.history).toHaveLength(1);
    expect(t.coach.calls[0]![0]).toBe("unhinged");
  });

  it("stops at the cycle cap", async () => {
    const { api } = await user();
    for (let i = 0; i < 3; i++) expect((await api.post("/api/coach/reviews", { fresh: true })).status).toBe(200);
    const capped = await api.post("/api/coach/reviews", { fresh: true });
    expect(capped.status).toBe(429);
    expect(capped.body.error).toBe("coach_cap");
    expect(t.coach.calls).toHaveLength(3);
  });

  it("sends aggregates only: no notes, names or email", async () => {
    const { api, who, food } = await user();
    await api.post("/api/transactions", {
      amount: NGN(4_500),
      categoryId: food,
      note: "birthday gift for Ada",
      date: ago(1),
    });
    await api.post("/api/coach/reviews", {});
    const sent = JSON.stringify(t.coach.calls[0]![1]);
    expect(sent).toContain("Food");
    expect(sent).not.toContain("Ada");
    expect(sent).not.toContain("birthday");
    expect(sent).not.toContain(who.user.email);
    expect(sent).not.toContain("Tester");
  });

  it("references the previous week's target, across a cycle close too", async () => {
    const { api } = await user();
    await api.post("/api/coach/reviews", {});
    expect(t.coach.calls[0]![1].previousReview).toBeNull();

    await api.post("/api/cycles/salary", {});
    await api.post("/api/coach/reviews", {});
    expect(t.coach.calls[1]![1].previousReview).toMatchObject({
      when: "last cycle",
      target: "Keep Food under NGN 10,000",
    });
  });

  it("says when it's unavailable or the model misbehaves, and stores nothing", async () => {
    const { api } = await user();
    t.coach.available = false;
    expect((await api.get("/api/coach")).body.available).toBe(false);
    expect((await api.post("/api/coach/reviews", {})).status).toBe(503);

    t.coach.available = true;
    t.coach.fail = true;
    expect((await api.post("/api/coach/reviews", {})).status).toBe(502);
    expect((await api.get("/api/coach")).body.used).toBe(0);
  });

  it("keeps reviews private to their budget", async () => {
    const a = await user();
    const b = await user();
    await a.api.post("/api/coach/reviews", {});
    expect((await b.api.get("/api/coach")).body).toMatchObject({ used: 0, current: null, history: [] });
  });
});
