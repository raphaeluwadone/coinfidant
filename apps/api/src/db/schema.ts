import { bigint, check, date, index, pgTable, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Only a SHA-256 of the cookie token is stored, so a DB leak can't be replayed as sessions.
export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
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
  (t) => [index("bills_user_id_idx").on(t.userId), check("bills_amount_positive", sql`${t.amount} > 0`)],
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
  ],
);

export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
