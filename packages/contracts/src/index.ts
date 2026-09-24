import { CATEGORY_KEYS } from "@coinfidant/engine";
import { z } from "zod";

const MAX_MINOR = 1e15;
const minor = z.int().positive().max(MAX_MINOR);

const isTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const currencySchema = z.enum(["NGN", "USD", "GBP", "EUR"]);
export const toneSchema = z.enum(["gentle", "cheeky", "unhinged"]);

export const billInput = z.object({ name: z.string().trim().min(1).max(40), amount: minor });

export const profileInput = z.object({
  salary: minor,
  savingsPercent: z.int().min(0).max(90),
  payday: z.int().min(1).max(31),
  timezone: z.string().max(64).refine(isTimeZone, "invalid timezone").default("Africa/Lagos"),
  currency: currencySchema.default("NGN"),
  bills: z.array(billInput).max(50),
});
export type ProfileInput = z.input<typeof profileInput>;

export const spendInput = z.object({
  amount: z.int().positive().max(1e13),
  category: z.enum(CATEGORY_KEYS),
  note: z.string().trim().max(120).optional(),
});
export type SpendInput = z.input<typeof spendInput>;

export const spendParams = z.object({ id: z.uuid() });
