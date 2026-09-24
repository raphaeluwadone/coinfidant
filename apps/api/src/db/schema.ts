import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  index,
  pgPolicy,
  pgRole,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/** Login role the API connects as. It owns nothing and can't bypass row-level security. */
export const appRole = pgRole("coinfidant_app").existing();

const ownRows = (table: string) =>
  pgPolicy(`${table}_owner`, {
    for: "all",
    to: appRole,
    using: sql`user_id = nullif(current_setting('app.user_id', true), '')::uuid`,
    withCheck: sql`user_id = nullif(current_setting('app.user_id', true), '')::uuid`,
  });

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  createdAt: createdAt(),
});

export const authIdentities = pgTable(
  "auth_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerUserId: text("provider_user_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique("auth_identities_provider_uid").on(t.provider, t.providerUserId), index().on(t.userId)],
);

// Hashes only. A family is one sign-in's chain of rotations; reusing a rotated token revokes the family.
export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    tokenHash: text("token_hash").primaryKey(),
    familyId: uuid("family_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    rotatedAt: timestamp("rotated_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.familyId), index().on(t.userId)],
);

const money = (name: string) => bigint(name, { mode: "number" });

export const profiles = pgTable(
  "profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    salary: money("salary").notNull(),
    savingsPercent: smallint("savings_percent").notNull(),
    payday: smallint("payday").notNull(),
    timezone: text("timezone").notNull().default("Africa/Lagos"),
    currency: text("currency").notNull().default("NGN"),
    personality: text("personality").notNull().default("cheeky"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("profiles_salary_positive", sql`${t.salary} > 0`),
    check("profiles_savings_range", sql`${t.savingsPercent} between 0 and 90`),
    check("profiles_payday_range", sql`${t.payday} between 1 and 31`),
    ownRows("profiles"),
  ],
);

export const bills = pgTable(
  "bills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    amount: money("amount").notNull(),
  },
  (t) => [
    index("bills_user_id_idx").on(t.userId),
    check("bills_amount_positive", sql`${t.amount} > 0`),
    ownRows("bills"),
  ],
);

// local_date is fixed at insert from the user's timezone so cycle queries don't shift if they travel.
export const spends = pgTable(
  "spends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: money("amount").notNull(),
    category: text("category").notNull(),
    note: text("note"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    localDate: date("local_date").notNull(),
  },
  (t) => [
    index("spends_user_date_idx").on(t.userId, t.localDate),
    check("spends_amount_positive", sql`${t.amount} > 0`),
    ownRows("spends"),
  ],
);

export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
