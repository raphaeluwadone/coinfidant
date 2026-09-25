import { addDays, localDate } from "@coinfidant/engine";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CheckinService } from "../src/push/checkin.service";
import { users } from "../src/db/schema";
import { as, createTestApp, type TestApp } from "./harness";

const NGN = (n: number) => n * 100;
const ago = (n: number) => addDays(localDate(new Date(), "Africa/Lagos"), -n);
const endpoint = (id: string) => `https://fcm.googleapis.com/fcm/send/${id}`;
const keys = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u", auth: "tBHItJI5svbpez7KI4CCXg" };

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());
beforeEach(() => {
  t.push.sent = [];
  t.push.gone.clear();
});

async function user(checkinMethod = "evening") {
  const who = await t.signIn();
  const api = as(t, who);
  const res = await api.post("/api/onboarding", {
    personality: "gentle",
    timezone: "Africa/Lagos",
    salary: NGN(400_000),
    expectedPayday: 31,
    lastSalaryOn: ago(16),
    bills: [{ name: "Rent", amount: NGN(60_000) }],
    sinkingFunds: [],
    debts: [],
    goals: [],
    commitments: [],
    everydayEstimate: NGN(100_000),
    discovery: false,
    leakCategories: [],
    overspendTimes: [],
    checkinMethod,
    leftoverDefault: "savings",
  });
  expect(res.status).toBe(201);
  const food = res.body.categories.find((c: { slug: string }) => c.slug === "food").id as string;
  return { api, who, food, budgetId: res.body.budget?.id as string | undefined };
}

// 20:30 in Lagos (UTC+1) on the given day.
const evening = (date: string) => new Date(`${date}T19:30:00Z`);

describe("health", () => {
  it("answers without a session", async () => {
    expect((await t.http().get("/api/health")).body).toEqual({ ok: true });
  });
});

describe("push check-ins", () => {
  it("only accepts real push services", async () => {
    const { api } = await user();
    expect((await api.post("/api/push/subscriptions", { endpoint: "https://evil.example/hook", keys })).status).toBe(
      400,
    );
    expect((await api.post("/api/push/subscriptions", { endpoint: "http://fcm.googleapis.com/x", keys })).status).toBe(
      400,
    );
    expect((await api.post("/api/push/subscriptions", { endpoint: endpoint("a"), keys })).status).toBe(204);
  });

  it("sends once in the evening hour, and forgets dropped devices", async () => {
    const { api, who } = await user();
    await api.post("/api/push/subscriptions", { endpoint: endpoint(`${who.user.id}-1`), keys });
    await api.post("/api/push/subscriptions", { endpoint: endpoint(`${who.user.id}-2`), keys });
    t.push.gone.add(endpoint(`${who.user.id}-2`));
    const checkins = t.app.get(CheckinService);
    const today = localDate(new Date(), "Africa/Lagos");

    await checkins.run(new Date(`${today}T10:00:00Z`));
    expect(t.push.sent.filter((s) => s.to.endpoint.includes(who.user.id))).toHaveLength(0);

    await checkins.run(evening(today));
    await checkins.run(evening(today));
    const mine = t.push.sent.filter((s) => s.to.endpoint.includes(who.user.id));
    expect(mine).toHaveLength(1);
    expect(mine[0]!.payload.body).toMatch(/^Evening\. Anything to log today\? You have NGN/);

    t.push.sent = [];
    await checkins.run(evening(addDays(today, 1)));
    expect(t.push.sent.filter((s) => s.to.endpoint.includes(who.user.id))).toHaveLength(1);
  });

  it("stays quiet for app-only people and unsubscribed devices", async () => {
    const quiet = await user("app");
    await quiet.api.post("/api/push/subscriptions", { endpoint: endpoint(quiet.who.user.id), keys });
    const gone = await user("evening");
    await gone.api.post("/api/push/subscriptions", { endpoint: endpoint(gone.who.user.id), keys });
    await gone.api.post("/api/push/unsubscribe", { endpoint: endpoint(gone.who.user.id) });

    await t.app.get(CheckinService).run(evening(localDate(new Date(), "Africa/Lagos")));
    const ids = [quiet.who.user.id, gone.who.user.id];
    expect(t.push.sent.filter((s) => ids.some((id) => s.to.endpoint.includes(id)))).toHaveLength(0);
  });
});

describe("export and deletion", () => {
  it("exports the budget without tokens or push keys", async () => {
    const { api, food } = await user();
    await api.post("/api/transactions", { amount: NGN(2_000), categoryId: food, note: "suya" });
    await api.post("/api/push/subscriptions", { endpoint: endpoint("export"), keys });
    const res = await api.get("/api/me/export");
    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toContain("attachment");
    const body = JSON.parse(res.text);
    expect(body.budgets[0].transactions[0]).toMatchObject({ amount: NGN(2_000), note: "suya" });
    expect(body.budgets[0].bills[0].name).toBe("Rent");
    expect(res.text).not.toContain(keys.auth);
    expect(res.text).not.toMatch(/token_hash|tokenHash/);
  });

  it("deletes the account and everything in it, after a typed confirmation", async () => {
    const { api, who } = await user();
    expect((await api.post("/api/me/delete", {})).status).toBe(400);
    const [before] = await t.db.select().from(users).where(eq(users.id, who.user.id));
    expect(before).toBeDefined();

    const res = await api.post("/api/me/delete", { confirm: "DELETE" });
    expect(res.status).toBe(204);
    expect(String(res.headers["set-cookie"])).toMatch(/cf_at=;/);
    expect(await t.db.select().from(users).where(eq(users.id, who.user.id))).toHaveLength(0);
    expect((await api.get("/api/budget")).status).toBe(401);
    expect((await api.post("/api/auth/refresh")).status).toBe(401);
  });

  it("can't touch someone else's budget", async () => {
    const a = await user();
    const b = await user();
    const mine = (await a.api.get("/api/budget")).body.budget.id as string;
    await b.api.post("/api/me/delete", { confirm: "DELETE" });
    expect((await a.api.get("/api/budget")).body.budget.id).toBe(mine);
  });
});
