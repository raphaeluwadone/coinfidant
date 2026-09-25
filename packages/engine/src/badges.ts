import { addDays, type ISODate } from "./date";
import type { ClosedCycle, OpenCycle, Week } from "./types";

export type BadgeKey =
  "sweepLord" | "floorIsLava" | "streak7" | "goalGetter" | "nightOwl" | "slowSteady" | "debtSlayer";

export const BADGES: { key: BadgeKey; name: string; emoji: string; how: string }[] = [
  { key: "sweepLord", name: "Sweep Lord", emoji: "🧹", how: "Sweep leftovers in 4 weeks of one cycle" },
  {
    key: "floorIsLava",
    name: "Floor Is Lava Survivor",
    emoji: "🫣",
    how: "Hit the floor and still close a cycle with savings",
  },
  { key: "streak7", name: "7-Day Streak Goblin", emoji: "👹", how: "Log something 7 days in a row" },
  { key: "goalGetter", name: "Goal Getter", emoji: "🎯", how: "Reach a savings goal" },
  { key: "nightOwl", name: "Night Owl Saver", emoji: "🌙", how: "Log 10 spends after 8pm and still sweep a week" },
  { key: "slowSteady", name: "Slow & Steady", emoji: "🐢", how: "Save something 3 cycles in a row" },
  { key: "debtSlayer", name: "Debt Slayer", emoji: "⚔️", how: "Pay off a debt completely" },
];

export type GrowthInput = {
  today: ISODate;
  /** Oldest first. */
  closed: ClosedCycle[];
  open: OpenCycle | null;
  /** Local date and hour of every logged spend. */
  logs: { date: ISODate; hour: number }[];
  debtsCleared: number;
  goalsReached: number;
};

const EVENING_HOUR = 20;

/** Consecutive logging days ending today, or yesterday when today hasn't been logged yet. */
export function currentStreak(dates: ISODate[], today: ISODate): number {
  const days = new Set(dates);
  let d = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function longestStreak(dates: ISODate[]): number {
  const sorted = [...new Set(dates)].sort();
  let best = 0;
  let run = 0;
  let prev: ISODate | null = null;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

// An untouched week sweeps too; only weeks you actually logged in count toward badges.
const sweptWeeks = (weeks: Week[]) => weeks.filter((w) => w.outcome?.kind === "swept" && w.spent > 0).length;

export function computeBadges(
  g: GrowthInput,
): { key: BadgeKey; name: string; emoji: string; how: string; earned: boolean }[] {
  const cycles = [...g.closed.map((c) => c.weeks), ...(g.open ? [g.open.weeks] : [])];
  const anySweep = cycles.some((w) => sweptWeeks(w) > 0);

  let savedRun = 0;
  let bestSavedRun = 0;
  for (const c of g.closed) {
    savedRun = c.savings.net > 0 ? savedRun + 1 : 0;
    bestSavedRun = Math.max(bestSavedRun, savedRun);
  }

  const earned: Record<BadgeKey, boolean> = {
    sweepLord: cycles.some((w) => sweptWeeks(w) >= 4),
    floorIsLava: g.closed.some(
      (c) => c.weeks.some((w) => w.outcome?.kind === "over" && w.outcome.floorHit) && c.savings.net > 0,
    ),
    streak7: longestStreak(g.logs.map((l) => l.date)) >= 7,
    goalGetter: g.goalsReached > 0,
    nightOwl: anySweep && g.logs.filter((l) => l.hour >= EVENING_HOUR).length >= 10,
    slowSteady: bestSavedRun >= 3,
    debtSlayer: g.debtsCleared > 0,
  };
  return BADGES.map((b) => ({ ...b, earned: earned[b.key] }));
}

export type RateTrend = "up" | "down" | "flat";

/** Compares the latest savings rate with the average of the ones before it. */
export function rateTrend(ratesBp: number[]): RateTrend {
  if (ratesBp.length < 2) return "flat";
  const last = ratesBp[ratesBp.length - 1]!;
  const before = ratesBp.slice(0, -1);
  const avg = before.reduce((a, b) => a + b, 0) / before.length;
  if (last > avg + 100) return "up";
  if (last < avg - 100) return "down";
  return "flat";
}
