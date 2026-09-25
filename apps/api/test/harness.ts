import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { TokensService } from "../src/auth/tokens.service";
import { UsersService } from "../src/auth/users.service";
import { CONFIG, loadConfig } from "../src/config";
import { DB, type Db } from "../src/db/db.module";
import { users } from "../src/db/schema";
import { configureApp } from "../src/setup";

export const ORIGIN = "http://localhost:5173";

export async function createTestApp() {
  const config = loadConfig({
    ...process.env,
    NODE_ENV: "test",
    WEB_ORIGIN: ORIGIN,
    GOOGLE_CLIENT_ID: "test-client-id",
    GOOGLE_CLIENT_SECRET: "test-client-secret",
    GOOGLE_CALLBACK_URL: `${ORIGIN}/api/auth/google/callback`,
  });
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CONFIG)
    .useValue(config)
    .compile();
  const app = configureApp(moduleRef.createNestApplication(), config) as INestApplication;
  // Listen once on IPv4 loopback. Letting supertest bind port 0 per request can pick a port that another local
  // process (e.g. an editor's WebSocket server) already holds on 127.0.0.1, which answers 426.
  await app.listen(0, "127.0.0.1");
  const { port } = app.getHttpServer().address() as { port: number };
  const base = `http://127.0.0.1:${port}`;

  const emails: string[] = [];
  const db = app.get<Db>(DB);

  return {
    app,
    db,
    http: () => request(base),
    users: app.get(UsersService),
    tokens: app.get(TokensService),

    /** Signs a user in the way the Google callback does and returns their cookie header. */
    async signIn(opts: { email?: string; providerUserId?: string; emailVerified?: boolean } = {}) {
      const email = opts.email ?? `test-${randomUUID()}@example.test`;
      emails.push(email);
      const user = await app.get(UsersService).signIn({
        provider: "google",
        providerUserId: opts.providerUserId ?? randomUUID(),
        email,
        emailVerified: opts.emailVerified ?? true,
        displayName: "Tester",
      });
      const tokens = app.get(TokensService);
      const refresh = await tokens.issueRefresh(user.id);
      const access = await tokens.signAccess(user.id);
      return { user, refresh, cookie: `cf_at=${access}; cf_rt=${refresh}` };
    },

    async close() {
      if (emails.length) await db.delete(users).where(inArray(users.email, emails));
      await app.close();
    },
  };
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;
export type Session = Awaited<ReturnType<TestApp["signIn"]>>;

/** NGN 400,000 salary, NGN 60,000 rent, 10% savings: NGN 300,000 flexible. */
export const SETUP = {
  salary: 400_000_00,
  expectedPayday: 31,
  savingsPercent: 10,
  bills: [{ name: "Rent", amount: 60_000_00 }],
  timezone: "Africa/Lagos",
};

export const as = (t: TestApp, who: Session) => {
  const write = (method: "post" | "put" | "patch", path: string, body?: object) =>
    t.http()[method](path).set("Origin", ORIGIN).set("Cookie", who.cookie).send(body);
  return {
    get: (path: string) => t.http().get(path).set("Cookie", who.cookie),
    post: (path: string, body?: object) => write("post", path, body),
    put: (path: string, body?: object) => write("put", path, body),
    patch: (path: string, body?: object) => write("patch", path, body),
    del: (path: string) => t.http().delete(path).set("Origin", ORIGIN).set("Cookie", who.cookie),
  };
};

export const cookieValue = (res: { headers: Record<string, unknown> }, name: string) => {
  const set = (res.headers["set-cookie"] as string[] | undefined) ?? [];
  const hit = set.find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.split(";")[0]!.slice(name.length + 1)) : undefined;
};
