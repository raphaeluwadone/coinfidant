import { profileInput } from "@coinfidant/contracts";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { requireUser, type AuthEnv } from "../auth/session";
import { loadProfile } from "../budget/load";
import { db } from "../db/client";
import { bills, profiles } from "../db/schema";

export const profile = new Hono<AuthEnv>()
  .use(requireUser)
  .get("/", async (c) => {
    const p = await loadProfile(c.get("user").id);
    return p ? c.json({ profile: p }) : c.json({ error: "no_profile" }, 404);
  })
  .put("/", zValidator("json", profileInput), async (c) => {
    const userId = c.get("user").id;
    const { bills: billList, ...fields } = c.req.valid("json");
    await db.transaction(async (tx) => {
      await tx
        .insert(profiles)
        .values({ userId, ...fields })
        .onConflictDoUpdate({ target: profiles.userId, set: { ...fields, updatedAt: new Date() } });
      await tx.delete(bills).where(eq(bills.userId, userId));
      if (billList.length) await tx.insert(bills).values(billList.map((b) => ({ ...b, userId })));
    });
    return c.json({ profile: await loadProfile(userId) });
  });
