import { spendInput, spendParams } from "@coinfidant/contracts";
import { localDate } from "@coinfidant/engine";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { requireUser, type AuthEnv } from "../auth/session";
import { loadProfile, loadToday } from "../budget/load";
import { db } from "../db/client";
import { spends } from "../db/schema";

export const spendRoutes = new Hono<AuthEnv>()
  .use(requireUser)
  .post("/", zValidator("json", spendInput), async (c) => {
    const userId = c.get("user").id;
    const p = await loadProfile(userId);
    if (!p) return c.json({ error: "no_profile" }, 409);
    const now = new Date();
    const [row] = await db
      .insert(spends)
      .values({ ...c.req.valid("json"), userId, occurredAt: now, localDate: localDate(now, p.timezone) })
      .returning();
    return c.json({ spend: row, today: await loadToday(userId, now) }, 201);
  })
  .delete("/:id", zValidator("param", spendParams), async (c) => {
    const userId = c.get("user").id;
    const deleted = await db
      .delete(spends)
      .where(and(eq(spends.id, c.req.valid("param").id), eq(spends.userId, userId)))
      .returning({ id: spends.id });
    if (!deleted.length) return c.json({ error: "not_found" }, 404);
    return c.json({ today: await loadToday(userId) });
  });

export const today = new Hono<AuthEnv>().use(requireUser).get("/", async (c) => {
  const data = await loadToday(c.get("user").id);
  return data ? c.json(data) : c.json({ error: "no_profile" }, 404);
});
