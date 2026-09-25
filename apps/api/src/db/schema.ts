import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  integer,
  check,
  date,
  index,
  jsonb,
  pgPolicy,
  pgRole,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** Login role the API connects as. It owns nothing and can't bypass row-level security. */
export const appRole = pgRole("coinfidant_app").existing();

// app_user() reads the per-transaction user set by ScopedDb (migration 0005).
const isMember = sql`budget_id in (select budget_id from budget_members where user_id = app_user())`;
const inMyBudgets = (table: string) =>
  pgPolicy(`${table}_member`, { for: "all", to: appRole, using: isMember, withCheck: isMember });

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const money = (name: string) => bigint(name, { mode: "number" });
const budgetRef = () =>
  uuid("budget_id")
    .notNull()
    .references(() => budgets.id, { onDelete: "cascade" });

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  timezone: text("timezone").notNull().default("Africa/Lagos"),
  personality: text("personality").notNull().default("cheeky"),
  checkinMethod: text("checkin_method").notNull().default("app"),
  leakCategories: text("leak_categories")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  overspendTimes: text("overspend_times")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
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

export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    currency: text("currency").notNull().default("NGN"),
    savingsPercent: smallint("savings_percent").notNull(),
    minSavingsPercent: smallint("min_savings_percent").notNull().default(5),
    floorPercent: smallint("floor_percent").notNull().default(70),
    weekStart: smallint("week_start").notNull().default(0),
    expectedPayday: smallint("expected_payday").notNull(),
    everydayEstimate: money("everyday_estimate"),
    leftoverDefault: text("leftover_default").notNull().default("savings"),
    paydayMode: boolean("payday_mode").notNull().default(false),
    // "No idea" in onboarding: a first cycle of logging only, no judgment.
    discovery: boolean("discovery").notNull().default(false),
    // The last detected phase, and the one before it while an advance is still to be celebrated.
    phase: text("phase"),
    phaseFrom: text("phase_from"),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.ownerId),
    check("budgets_savings_range", sql`${t.savingsPercent} between 0 and 90`),
    check("budgets_min_savings_range", sql`${t.minSavingsPercent} between 0 and 90`),
    check("budgets_floor_range", sql`${t.floorPercent} between 0 and 100`),
    check("budgets_week_start_range", sql`${t.weekStart} between 0 and 6`),
    check("budgets_payday_range", sql`${t.expectedPayday} between 1 and 31`),
    check("budgets_leftover_default", sql`${t.leftoverDefault} in ('savings', 'debts')`),
    // The creator can see their budget before the membership row exists.
    pgPolicy("budgets_member", {
      for: "all",
      to: appRole,
      using: sql`owner_id = app_user() or id in (select budget_id from budget_members where user_id = app_user())`,
      withCheck: sql`owner_id = app_user() or id in (select budget_id from budget_members where user_id = app_user())`,
    }),
  ],
);

export const budgetMembers = pgTable(
  "budget_members",
  {
    budgetId: budgetRef(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("owner"),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.budgetId, t.userId] }),
    index().on(t.userId),
    pgPolicy("budget_members_self", {
      for: "all",
      to: appRole,
      using: sql`user_id = app_user()`,
      withCheck: sql`user_id = app_user()`,
    }),
  ],
);

export const incomes = pgTable(
  "incomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    budgetId: budgetRef(),
    name: text("name").notNull(),
    amount: money("amount").notNull(),
    kind: text("kind").notNull().default("salary"),
  },
  (t) => [index().on(t.budgetId), check("incomes_amount_positive", sql`${t.amount} > 0`), inMyBudgets("incomes")],
);

export const bills = pgTable(
  "bills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    budgetId: budgetRef(),
    name: text("name").notNull(),
    amount: money("amount").notNull(),
  },
  (t) => [index().on(t.budgetId), check("bills_amount_positive", sql`${t.amount} > 0`), inMyBudgets("bills")],
);

export const sinkingFunds = pgTable(
  "sinking_funds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    budgetId: budgetRef(),
    name: text("name").notNull(),
    target: money("target").notNull(),
    saved: money("saved").notNull().default(0),
    dueDate: date("due_date").notNull(),
  },
  (t) => [
    index().on(t.budgetId),
    check("sinking_funds_amounts", sql`${t.target} > 0 and ${t.saved} >= 0`),
    inMyBudgets("sinking_funds"),
  ],
);

export const debts = pgTable(
  "debts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    budgetId: budgetRef(),
    name: text("name").notNull(),
    creditor: text("creditor").notNull(),
    amountLeft: money("amount_left").notNull(),
    // What was owed when the debt was added, so progress bars know how far it has come.
    originalAmount: money("original_amount").notNull().default(0),
    hasInterest: boolean("has_interest").notNull().default(false),
    plan: text("plan").notNull(),
    dueDate: date("due_date"),
    perCycle: money("per_cycle"),
    minAmount: money("min_amount"),
    idealAmount: money("ideal_amount"),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.budgetId),
    check("debts_amount_left", sql`${t.amountLeft} >= 0`),
    check(
      "debts_plan_fields",
      sql`(${t.plan} = 'oneOff' and ${t.dueDate} is not null)
        or (${t.plan} = 'installments' and ${t.perCycle} > 0)
        or (${t.plan} = 'flexible' and ${t.minAmount} >= 0 and ${t.idealAmount} >= ${t.minAmount})`,
    ),
    inMyBudgets("debts"),
  ],
);

export const commitments = pgTable(
  "commitments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    budgetId: budgetRef(),
    name: text("name").notNull(),
    minAmount: money("min_amount").notNull(),
    idealAmount: money("ideal_amount").notNull(),
  },
  (t) => [
    index().on(t.budgetId),
    check("commitments_amounts", sql`${t.minAmount} >= 0 and ${t.idealAmount} >= ${t.minAmount}`),
    inMyBudgets("commitments"),
  ],
);

export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    budgetId: budgetRef(),
    name: text("name").notNull(),
    emoji: text("emoji").notNull().default("🎯"),
    target: money("target").notNull(),
    saved: money("saved").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.budgetId),
    check("goals_amounts", sql`${t.target} > 0 and ${t.saved} >= 0`),
    inMyBudgets("goals"),
  ],
);

// `slug` marks the built-in defaults so auto-tags can recognise them after a rename.
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    budgetId: budgetRef(),
    name: text("name").notNull(),
    emoji: text("emoji").notNull(),
    slug: text("slug"),
    position: smallint("position").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [index().on(t.budgetId), inMyBudgets("categories")],
);

export const cycles = pgTable(
  "cycles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    budgetId: budgetRef(),
    startDate: date("start_date").notNull(),
    salary: money("salary").notNull(),
    status: text("status").notNull().default("open"),
    endDate: date("end_date"),
    snapshot: jsonb("snapshot"),
    engineVersion: text("engine_version"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    // Null until the Payday flow has been shown for this cycle.
    paydaySeenAt: timestamp("payday_seen_at", { withTimezone: true }),
    // Discovery results, stored on the cycle that did the learning.
    learned: jsonb("learned"),
    // The engine input the close ran on, so edits in the adjustment window can re-run exactly that close.
    closeInput: jsonb("close_input"),
    createdAt: createdAt(),
  },
  (t) => [
    unique("cycles_budget_start").on(t.budgetId, t.startDate),
    uniqueIndex("cycles_one_open")
      .on(t.budgetId)
      .where(sql`${t.status} = 'open'`),
    check("cycles_status", sql`${t.status} in ('open', 'closed', 'locked')`),
    check("cycles_salary_positive", sql`${t.salary} > 0`),
    inMyBudgets("cycles"),
  ],
);

// local_date is fixed at insert from the user's timezone so cycle queries don't shift if they travel.
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    budgetId: budgetRef(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    amount: money("amount").notNull(),
    type: text("type").notNull().default("spend"),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    note: text("note"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    localDate: date("local_date").notNull(),
  },
  (t) => [
    index().on(t.budgetId, t.localDate),
    check("transactions_amount_positive", sql`${t.amount} > 0`),
    check("transactions_type", sql`${t.type} in ('spend', 'refund')`),
    inMyBudgets("transactions"),
  ],
);

export const debtPayments = pgTable(
  "debt_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    budgetId: budgetRef(),
    debtId: uuid("debt_id")
      .notNull()
      .references(() => debts.id, { onDelete: "cascade" }),
    cycleId: uuid("cycle_id")
      .notNull()
      .references(() => cycles.id, { onDelete: "cascade" }),
    amount: money("amount").notNull(),
    paidOn: date("paid_on").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.cycleId),
    check("debt_payments_amount_positive", sql`${t.amount} > 0`),
    inMyBudgets("debt_payments"),
  ],
);

export const cycleTopUps = pgTable(
  "cycle_top_ups",
  {
    budgetId: budgetRef(),
    cycleId: uuid("cycle_id")
      .notNull()
      .references(() => cycles.id, { onDelete: "cascade" }),
    itemKind: text("item_kind").notNull(),
    itemId: uuid("item_id").notNull(),
    amount: money("amount").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.cycleId, t.itemId] }),
    check("cycle_top_ups_kind", sql`${t.itemKind} in ('commitment', 'debt')`),
    check("cycle_top_ups_amount", sql`${t.amount} > 0`),
    inMyBudgets("cycle_top_ups"),
  ],
);

export const sweepChoices = pgTable(
  "sweep_choices",
  {
    budgetId: budgetRef(),
    cycleId: uuid("cycle_id")
      .notNull()
      .references(() => cycles.id, { onDelete: "cascade" }),
    weekIndex: smallint("week_index").notNull(),
    debtId: uuid("debt_id").references(() => debts.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.cycleId, t.weekIndex] }), inMyBudgets("sweep_choices")],
);

/** Stored coach reviews (M8): the exact payload sent, what came back, and what it cost. */
export const adviceReviews = pgTable(
  "advice_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    budgetId: budgetRef(),
    cycleId: uuid("cycle_id")
      .notNull()
      .references(() => cycles.id, { onDelete: "cascade" }),
    weekIndex: smallint("week_index").notNull(),
    pace: text("pace").notNull(),
    payload: jsonb("payload").notNull(),
    review: jsonb("review").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.budgetId, t.createdAt),
    index().on(t.cycleId),
    check("advice_reviews_pace", sql`${t.pace} in ('ahead', 'onPace', 'behind')`),
    inMyBudgets("advice_reviews"),
  ],
);

export type User = typeof users.$inferSelect;
