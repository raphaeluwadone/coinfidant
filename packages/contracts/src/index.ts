import { z } from "zod";

const MAX_MINOR = 1e15;
const minor = z.int().positive().max(MAX_MINOR);
const minorOrZero = z.int().min(0).max(MAX_MINOR);
const name = z.string().trim().min(1).max(40);
const isoDate = z.iso.date();

const isTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};
const timezone = z.string().max(64).refine(isTimeZone, "invalid timezone");

export const currencySchema = z.enum(["NGN", "USD", "GBP", "EUR"]);
export const toneSchema = z.enum(["gentle", "cheeky", "unhinged"]);

export const idParam = z.object({ id: z.uuid() });

export const leakSchema = z.enum(["food", "drinks", "transport", "treating", "impulse"]);
export const overspendTimeSchema = z.enum(["afterPayday", "weekends", "monthEnd"]);
export const checkinSchema = z.enum(["evening", "drift", "app"]);
export const leftoverSchema = z.enum(["debts", "savings"]);

export const preferencesInput = z
  .object({
    timezone,
    personality: toneSchema,
    displayName: name.nullable(),
    checkinMethod: checkinSchema,
    leakCategories: z.array(leakSchema).max(5),
    overspendTimes: z.array(overspendTimeSchema).max(3),
  })
  .partial();
export type PreferencesInput = z.input<typeof preferencesInput>;

export const billInput = z.object({ name, amount: minor });
export const incomeInput = z.object({ name, amount: minor });

/** First-run setup and "edit my plan": the handful of fields onboarding asks for. */
export const setupInput = z.object({
  salary: minor,
  expectedPayday: z.int().min(1).max(31),
  savingsPercent: z.int().min(0).max(90),
  bills: z.array(billInput).max(50),
  currency: currencySchema.default("NGN"),
  timezone: timezone.optional(),
  lastSalaryOn: isoDate.optional(),
});
export type SetupInput = z.input<typeof setupInput>;

export const settingsInput = z
  .object({
    savingsPercent: z.int().min(0).max(90),
    minSavingsPercent: z.int().min(0).max(90),
    floorPercent: z.int().min(0).max(100),
    weekStart: z.int().min(0).max(6),
    expectedPayday: z.int().min(1).max(31),
    everydayEstimate: minorOrZero.nullable(),
    currency: currencySchema,
    leftoverDefault: leftoverSchema,
    paydayMode: z.boolean(),
    discovery: z.boolean(),
  })
  .partial();
export type SettingsInput = z.input<typeof settingsInput>;

export const sinkingFundInput = z.object({ name, target: minor, saved: minorOrZero.default(0), dueDate: isoDate });

export const debtPlan = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("oneOff"), due: isoDate }),
  z.object({ kind: z.literal("installments"), perCycle: minor }),
  z
    .object({ kind: z.literal("flexible"), min: minorOrZero, ideal: minorOrZero })
    .refine((p) => p.ideal >= p.min, "ideal must be at least the minimum"),
]);
export const debtInput = z.object({
  name,
  creditor: name,
  amountLeft: minorOrZero,
  hasInterest: z.boolean().default(false),
  plan: debtPlan,
});
export type DebtInput = z.input<typeof debtInput>;

export const commitmentInput = z
  .object({ name, min: minorOrZero, ideal: minorOrZero })
  .refine((c) => c.ideal >= c.min, "ideal must be at least the minimum");

export const goalInput = z.object({ name, emoji: z.string().min(1).max(16).default("🎯"), target: minor });

/** Everything the 10 onboarding steps collect, saved in one go at the plan reveal. */
export const onboardingInput = z.object({
  personality: toneSchema,
  timezone,
  currency: currencySchema.default("NGN"),
  salary: minor,
  expectedPayday: z.int().min(1).max(31),
  lastSalaryOn: isoDate,
  savingsPercent: z.int().min(0).max(90).default(10),
  bills: z.array(billInput).max(50),
  sinkingFunds: z.array(sinkingFundInput).max(20),
  debts: z.array(debtInput).max(50),
  goals: z.array(goalInput).max(20),
  commitments: z.array(commitmentInput).max(20),
  everydayEstimate: minorOrZero.nullable(),
  discovery: z.boolean(),
  leakCategories: z.array(leakSchema).max(5),
  overspendTimes: z.array(overspendTimeSchema).max(3),
  checkinMethod: checkinSchema,
  leftoverDefault: leftoverSchema,
});
export type OnboardingInput = z.input<typeof onboardingInput>;

export const categoryInput = z.object({ name: z.string().trim().min(1).max(24), emoji: z.string().min(1).max(16) });
export const categoryPatch = categoryInput.partial().extend({ position: z.int().min(0).max(99).optional() });

export const transactionInput = z.object({
  amount: z.int().positive().max(1e13),
  categoryId: z.uuid(),
  type: z.enum(["spend", "refund"]).default("spend"),
  note: z.string().trim().max(120).optional(),
  date: isoDate.optional(),
});
export type TransactionInput = z.input<typeof transactionInput>;
export const transactionPatch = transactionInput.partial();

export const salaryInput = z.object({ amount: minor.optional(), receivedOn: isoDate.optional() });
export const debtPaymentInput = z.object({ amount: minor, paidOn: isoDate.optional() });
export const topUpInput = z.object({ amount: minorOrZero });
export const sweepChoiceInput = z.object({ debtId: z.uuid().nullable() });
export const weekParam = z.object({ week: z.coerce.number().int().min(0).max(6) });

export const MAX_ACTIVE_CATEGORIES = 12;
