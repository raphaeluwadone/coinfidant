import { daysBetween, type ISODate } from "./date";
import type { Minor } from "./money";

export type DiscoveryTxn = { amount: Minor; date: ISODate; type: "spend" | "refund"; categoryId: string };

export type DiscoveryProgress = {
  day: number;
  days: number;
  /** 0–100: how much of the spending pattern we trust, from time elapsed and how consistently days get logged. */
  confidence: number;
  categories: { categoryId: string; spent: Minor; monthly: Minor | null }[];
};

const LEARNED_MIN_SPENDS = 3;
const LEARNED_MIN_DAYS = 2;
const ROUND_TO = 100_000; // NGN 1,000 while estimating
const FINAL_ROUND_TO = 10_000; // NGN 100 once the cycle is done

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/** R25 */
export function discoveryProgress(
  txns: DiscoveryTxn[],
  cycle: { start: ISODate; days: number },
  today: ISODate,
  opts: { final?: boolean } = {},
): DiscoveryProgress {
  const elapsed = Math.min(cycle.days, Math.max(0, daysBetween(cycle.start, today) + 1));
  const inCycle = txns.filter((t) => t.date >= cycle.start && t.date <= today);
  const loggedDays = new Set(inCycle.filter((t) => t.type === "spend").map((t) => t.date)).size;
  const confidence = elapsed
    ? Math.round(100 * Math.min(1, 0.7 * (elapsed / cycle.days) + 0.3 * (loggedDays / elapsed)))
    : 0;

  const byCategory = new Map<string, { spent: number; spends: number; days: Set<ISODate> }>();
  for (const t of inCycle) {
    const c = byCategory.get(t.categoryId) ?? { spent: 0, spends: 0, days: new Set<ISODate>() };
    c.spent += t.type === "refund" ? -t.amount : t.amount;
    if (t.type === "spend") {
      c.spends++;
      c.days.add(t.date);
    }
    byCategory.set(t.categoryId, c);
  }

  const categories = [...byCategory.entries()]
    .filter(([, c]) => c.spent > 0)
    .map(([categoryId, c]) => {
      if (opts.final) return { categoryId, spent: c.spent, monthly: roundTo(c.spent, FINAL_ROUND_TO) };
      const learned = c.spends >= LEARNED_MIN_SPENDS && c.days.size >= LEARNED_MIN_DAYS;
      return {
        categoryId,
        spent: c.spent,
        monthly: learned ? roundTo((c.spent / elapsed) * cycle.days, ROUND_TO) : null,
      };
    })
    .sort((a, b) => Number(b.monthly !== null) - Number(a.monthly !== null) || b.spent - a.spent);

  return { day: elapsed, days: cycle.days, confidence: opts.final ? 100 : confidence, categories };
}
