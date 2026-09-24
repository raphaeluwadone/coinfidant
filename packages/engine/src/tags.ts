import { addDays, type ISODate, weekday } from "./date";
import type { Minor } from "./money";

export type TaggableSpend = {
  id: string;
  amount: Minor;
  category: string;
  occurredAt: string;
  localDate: ISODate;
};

const ORDINAL = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${s}`;
};

const RUN_NOUN: Record<string, string> = {
  food: "food run",
  groceries: "grocery run",
  transport: "ride",
  shopping: "shopping trip",
  fun: "fun outing",
  health: "health spend",
  home: "home spend",
  other: "mystery spend",
};

const FLAVOUR: Record<string, string> = {
  food: "Fuel for the soul",
  groceries: "Big shop energy",
  transport: "Getting places",
  shopping: "Retail therapy",
  fun: "Joy budget in action",
  health: "Investing in you",
  home: "Nest upgrades",
  other: "Keeping it mysterious",
};

const localHour = (iso: string, timeZone: string) =>
  Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(new Date(iso)));

/** A short playful label for a spend, derived from what else happened around it. */
export function autoTag(
  spend: TaggableSpend,
  history: TaggableSpend[],
  ctx: { timeZone: string; dailyPace: Minor },
): string {
  const monday = addDays(spend.localDate, -weekday(spend.localDate));
  const sameThisWeek = history.filter(
    (h) =>
      h.category === spend.category &&
      h.localDate >= monday &&
      (h.occurredAt < spend.occurredAt || (h.occurredAt === spend.occurredAt && h.id <= spend.id)),
  ).length;

  if (sameThisWeek >= 3) return `${ORDINAL(sameThisWeek)} ${RUN_NOUN[spend.category] ?? "spend"} this week`;
  if (spend.amount >= 500_000 && spend.amount % 100_000 === 0) return "Suspiciously round number";
  const hour = localHour(spend.occurredAt, ctx.timeZone);
  if (hour >= 22 || hour < 4) return "Late-night decision";
  if (ctx.dailyPace > 0 && spend.amount > ctx.dailyPace) return "Big spend energy";
  const wd = weekday(spend.localDate);
  if (wd === 4 && hour >= 16) return "Friday energy";
  if (wd >= 5) return "Weekend mode";
  if (sameThisWeek === 2) return `2nd ${RUN_NOUN[spend.category] ?? "spend"} this week`;
  return FLAVOUR[spend.category] ?? FLAVOUR.other!;
}
