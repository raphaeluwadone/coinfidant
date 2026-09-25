import { type INestApplication, Logger } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import type { NextFunction, Request, Response } from "express";
import { join, resolve } from "node:path";
import type { Config } from "./config";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ");

// Ids and tokens in paths are masked so logs never carry them.
const maskPath = (url: string) =>
  url
    .split("?")[0]!
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .replace(/\/[A-Za-z0-9_-]{24,}/g, "/:token");

export function configureApp(app: INestApplication, config: Config) {
  const prod = config.NODE_ENV === "production";
  const express = app as NestExpressApplication;
  // Fly's proxy sits in front; without this every request shares one IP and the rate limits turn global.
  if (prod) express.set("trust proxy", 1);

  app.setGlobalPrefix("api");
  app.use(cookieParser());
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    if (prod) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    next();
  });

  if (config.NODE_ENV !== "test") {
    const log = new Logger("http");
    app.use((req: Request, res: Response, next: NextFunction) => {
      const start = performance.now();
      res.on("finish", () => {
        if (req.path === "/api/health") return;
        log.log({
          method: req.method,
          path: maskPath(req.originalUrl),
          status: res.statusCode,
          ms: Math.round(performance.now() - start),
        });
      });
      next();
    });
  }

  // Cookies are SameSite=Lax; this also rejects same-site cross-origin writes.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!SAFE_METHODS.has(req.method) && req.headers.origin !== config.WEB_ORIGIN) {
      res.status(403).json({ error: "forbidden_origin" });
      return;
    }
    next();
  });

  if (config.WEB_DIST) serveWeb(express, config.WEB_DIST);
  app.enableShutdownHooks();
  return app;
}

/** The built PWA: hashed assets cached for a year, everything else revalidated, SPA routes fall back to index.html. */
function serveWeb(app: NestExpressApplication, webDist: string) {
  const dir = resolve(webDist);
  app.useStaticAssets(dir, {
    index: false,
    setHeaders: (res, path) => {
      res.setHeader("Content-Security-Policy", CSP);
      res.setHeader(
        "Cache-Control",
        path.includes(`${join("/", "assets")}/`) ? "public, max-age=31536000, immutable" : "no-cache",
      );
    },
  });
  const index = join(dir, "index.html");
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET" || req.path.startsWith("/api/") || req.path === "/api") return next();
    res.setHeader("Content-Security-Policy", CSP);
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(index);
  });
}
