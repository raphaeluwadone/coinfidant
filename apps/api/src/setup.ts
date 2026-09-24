import type { INestApplication } from "@nestjs/common";
import cookieParser from "cookie-parser";
import type { NextFunction, Request, Response } from "express";
import type { Config } from "./config";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function configureApp(app: INestApplication, config: Config) {
  app.setGlobalPrefix("api");
  app.use(cookieParser());
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });
  // Cookies are SameSite=Lax; this also rejects same-site cross-origin writes.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!SAFE_METHODS.has(req.method) && req.headers.origin !== config.WEB_ORIGIN) {
      res.status(403).json({ error: "forbidden_origin" });
      return;
    }
    next();
  });
  app.enableShutdownHooks();
  return app;
}
