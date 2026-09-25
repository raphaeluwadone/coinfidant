import { addDays, type ISODate, weekday } from "./date";
import type { Minor } from "./money";
import { say, type Tone, type VoiceKey } from "./voice";

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

const localHour = (iso: string, timeZone: string) =>
  Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(new Date(iso)));

/** A short playful label for a spend, derived from what else happened around it. */
export function autoTag(
  spend: TaggableSpend,
  history: TaggableSpend[],
  ctx: { timeZone: string; dailyPace: Minor; tone?: Tone },
): string {
  const tone = ctx.tone ?? "cheeky";
  const run = (n: number) => say("tag.run", tone, { nth: ORDINAL(n), noun: RUN_NOUN[spend.category] ?? "spend" });
  const monday = addDays(spend.localDate, -weekday(spend.localDate));
  const sameThisWeek = history.filter(
    (h) =>
      h.category === spend.category &&
      h.localDate >= monday &&
      (h.occurredAt < spend.occurredAt || (h.occurredAt === spend.occurredAt && h.id <= spend.id)),
  ).length;

  if (sameThisWeek >= 3) return run(sameThisWeek);
  if (spend.amount >= 500_000 && spend.amount % 100_000 === 0) return say("tag.round", tone);
  const hour = localHour(spend.occurredAt, ctx.timeZone);
  if (hour >= 22 || hour < 4) return say("tag.late", tone);
  if (ctx.dailyPace > 0 && spend.amount > ctx.dailyPace) return say("tag.big", tone);
  const wd = weekday(spend.localDate);
  if (wd === 4 && hour >= 16) return say("tag.friday", tone);
  if (wd >= 5) return say("tag.weekend", tone);
  if (sameThisWeek === 2) return run(2);
  const flavour = `tag.flavour.${spend.category in RUN_NOUN ? spend.category : "other"}` as VoiceKey;
  return say(flavour, tone);
}
