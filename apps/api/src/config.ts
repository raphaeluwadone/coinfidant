import { z } from "zod";

const optional = z
  .string()
  .optional()
  .transform((v) => v || undefined);

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(8787),
  DATABASE_URL: z.url(),
  WEB_ORIGIN: z.url(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_CALLBACK_URL: z.url(),
  // The coach is optional: without a key the rest of the app runs and /coach says it's unavailable.
  ANTHROPIC_API_KEY: optional,
  COACH_MODEL: z.string().min(1).default("claude-sonnet-5"),
  COACH_CYCLE_CAP: z.coerce.number().int().min(0).default(6),
  // Web push is optional too: npx web-push generate-vapid-keys
  VAPID_PUBLIC_KEY: optional,
  VAPID_PRIVATE_KEY: optional,
  VAPID_SUBJECT: optional,
  /** Built web app to serve alongside the API in production (one origin, so cookies stay first-party). */
  WEB_DIST: optional,
  CHECKIN_HOUR: z.coerce.number().int().min(0).max(23).default(20),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid API environment:\n${problems}`);
  }
  return parsed.data;
}

export const CONFIG = Symbol("CONFIG");
