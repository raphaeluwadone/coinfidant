import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { secureHeaders } from "hono/secure-headers";
import { auth } from "./routes/auth";
import { profile } from "./routes/profile";
import { spendRoutes, today } from "./routes/spends";

const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173";
const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

// hono/csrf only inspects form content types; this covers JSON bodies too.
const sameOrigin = createMiddleware(async (c, next) => {
  if (!SAFE.has(c.req.method) && c.req.header("origin") !== webOrigin) {
    return c.json({ error: "forbidden_origin" }, 403);
  }
  await next();
});

export const app = new Hono()
  .use(secureHeaders())
  .use(sameOrigin)
  .get("/api/health", (c) => c.json({ ok: true }))
  .route("/api/auth", auth)
  .route("/api/profile", profile)
  .route("/api/spends", spendRoutes)
  .route("/api/today", today);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "internal" }, 500);
});

export type AppType = typeof app;
