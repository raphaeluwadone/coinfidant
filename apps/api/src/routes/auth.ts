import { hash, verify } from "@node-rs/argon2";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { endSession, requireUser, startSession, type AuthEnv } from "../auth/session";
import { db } from "../db/client";
import { users } from "../db/schema";

const credentials = z.object({
  email: z
    .email()
    .max(254)
    .transform((e) => e.trim().toLowerCase()),
  password: z.string().min(10).max(128),
});

const signup = credentials.extend({
  displayName: z.string().trim().min(1).max(40).optional(),
});

// Verified against on unknown emails so login timing doesn't reveal which accounts exist.
const DUMMY_HASH = await hash("not-a-real-password-placeholder");

export const auth = new Hono<AuthEnv>()
  .post("/signup", zValidator("json", signup), async (c) => {
    const { email, password, displayName } = c.req.valid("json");
    const passwordHash = await hash(password);
    const [user] = await db
      .insert(users)
      .values({ email, passwordHash, displayName })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id, email: users.email, displayName: users.displayName });
    if (!user) return c.json({ error: "email_taken" }, 409);
    await startSession(c, user.id);
    return c.json({ user }, 201);
  })
  .post("/login", zValidator("json", credentials), async (c) => {
    const { email, password } = c.req.valid("json");
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const ok = await verify(user?.passwordHash ?? DUMMY_HASH, password);
    if (!user || !ok) return c.json({ error: "invalid_credentials" }, 401);
    await startSession(c, user.id);
    return c.json({ user: { id: user.id, email: user.email, displayName: user.displayName } });
  })
  .post("/logout", async (c) => {
    await endSession(c);
    return c.body(null, 204);
  })
  .get("/me", requireUser, (c) => c.json({ user: c.get("user") }));
