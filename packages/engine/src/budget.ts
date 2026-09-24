import { addDays, daysBetween, daysInMonth, type ISODate, weekday } from "./date";
import type { Minor } from "./money";

export const FLOOR_RATIO = 0.7;

export type Plan = {
  salary: Minor;
  bills: { name: string; amount: Minor }[];
  /** Percent of salary set aside before weekly budgets are split. */
  savingsPercent: number;
  /** Day of month, 1–31. Clamped to the month's last day. */
  payday: number;
};

export type Spend = { amount: Minor; date: ISODate };

export type WeekOutcome =
  { kind: "swept"; amount: Minor } | { kind: "over"; amount: Minor; spread: Minor; borrowed: Minor; floorHit: boolean };

export type Week = {
  index: number;
  start: ISODate;
  end: ISODate;
  days: number;
  base: Minor;
  floor: Minor;
  /** Base minus deficits absorbed from earlier weeks. */
  budget: Minor;
  spent: Minor;
  status: "past" | "current" | "future";
  outcome?: WeekOutcome;
};

export type DayState = "on" | "covered" | "over" | "today" | "upcoming" | "outside";
export type DayCell = { date: ISODate; spent: Minor; state: DayState };

export type Snapshot = {
  cycle: { start: ISODate; end: ISODate; days: number; dayIndex: number };
  plan: { salary: Minor; bills: Minor; savings: Minor; spendable: Minor };
  weeks: Week[];
  today: {
    date: ISODate;
    week: Week;
    spendToday: Minor;
    spentToday: Minor;
    dailyPace: Minor;
    leftThisWeek: Minor;
    daysLeftInWeek: number;
    strip: DayCell[];
  };
  savings: { planned: Minor; swept: Minor; borrowed: Minor; net: Minor };
  warnings: "overcommitted"[];
};

export function paydayIn(year: number, month1: number, payday: number): ISODate {
  const day = Math.min(payday, daysInMonth(year, month1));
  return `${year}-${String(month1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const shiftMonth = (y: number, m: number, by: number) => {
  const i = y * 12 + (m - 1) + by;
  return [Math.floor(i / 12), (i % 12) + 1] as const;
};

export function cycleFor(today: ISODate, payday: number): { start: ISODate; end: ISODate } {
  const [y, m] = today.split("-").map(Number) as [number, number];
  const thisPayday = paydayIn(y, m, payday);
  if (today >= thisPayday) {
    const [ny, nm] = shiftMonth(y, m, 1);
    return { start: thisPayday, end: addDays(paydayIn(ny, nm, payday), -1) };
  }
  const [py, pm] = shiftMonth(y, m, -1);
  return { start: paydayIn(py, pm, payday), end: addDays(thisPayday, -1) };
}

/** Splits `total` across `weights` in integers that sum exactly to `total` (largest remainder). */
export function allocate(total: Minor, weights: number[]): Minor[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0) return [];
  const w = sum > 0 ? weights : weights.map(() => 1);
  const wSum = sum > 0 ? sum : weights.length;
  const raw = w.map((x) => (total * x) / wSum);
  const out = raw.map(Math.floor);
  let rest = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rest > 0; k = (k + 1) % order.length, rest--) out[order[k]![1]]! += 1;
  return out;
}

/** Spreads `amount` across weeks in proportion to `weights`, never taking more than each week's `caps`. */
export function spreadDeficit(amount: Minor, weights: number[], caps: Minor[]) {
  const taken = caps.map(() => 0);
  let remaining = amount;
  let active = caps.map((_, i) => i).filter((i) => caps[i]! > 0);
  while (remaining > 0 && active.length > 0) {
    const shares = allocate(
      remaining,
      active.map((i) => weights[i]!),
    );
    let absorbed = 0;
    active.forEach((i, k) => {
      const t = Math.min(shares[k]!, caps[i]! - taken[i]!);
      taken[i]! += t;
      absorbed += t;
    });
    remaining -= absorbed;
    active = active.filter((i) => taken[i]! < caps[i]!);
    if (absorbed === 0) break;
  }
  return { taken, leftover: remaining };
}

function splitWeeks(start: ISODate, end: ISODate) {
  const weeks: { start: ISODate; end: ISODate; days: number }[] = [];
  let s = start;
  while (s <= end) {
    const sunday = addDays(s, 6 - weekday(s));
    const e = sunday < end ? sunday : end;
    weeks.push({ start: s, end: e, days: daysBetween(s, e) + 1 });
    s = addDays(e, 1);
  }
  return weeks;
}

export function computeSnapshot(plan: Plan, spends: Spend[], today: ISODate): Snapshot {
  const cycle = cycleFor(today, plan.payday);
  const cycleDays = daysBetween(cycle.start, cycle.end) + 1;

  const bills = plan.bills.reduce((a, b) => a + b.amount, 0);
  const savings = Math.round((plan.salary * plan.savingsPercent) / 100);
  const rawSpendable = plan.salary - bills - savings;
  const spendable = Math.max(0, rawSpendable);

  const inCycle = spends.filter((s) => s.date >= cycle.start && s.date <= cycle.end);
  const spentOn = (from: ISODate, to: ISODate) =>
    inCycle.filter((s) => s.date >= from && s.date <= to).reduce((a, s) => a + s.amount, 0);

  const spans = splitWeeks(cycle.start, cycle.end);
  const bases = allocate(
    spendable,
    spans.map((w) => w.days),
  );
  const weeks: Week[] = spans.map((w, index) => ({
    ...w,
    index,
    base: bases[index]!,
    floor: Math.round(bases[index]! * FLOOR_RATIO),
    budget: bases[index]!,
    spent: spentOn(w.start, w.end),
    status: w.end < today ? "past" : w.start > today ? "future" : "current",
  }));

  let swept = 0;
  let borrowed = 0;
  for (const week of weeks) {
    if (week.status !== "past") break;
    if (week.spent <= week.budget) {
      week.outcome = { kind: "swept", amount: week.budget - week.spent };
      swept += week.budget - week.spent;
      continue;
    }
    const deficit = week.spent - week.budget;
    const later = weeks.slice(week.index + 1);
    const { taken, leftover } = spreadDeficit(
      deficit,
      later.map((w) => w.base),
      later.map((w) => Math.max(0, w.budget - w.floor)),
    );
    later.forEach((w, k) => (w.budget -= taken[k]!));
    borrowed += leftover;
    week.outcome = {
      kind: "over",
      amount: deficit,
      spread: deficit - leftover,
      borrowed: leftover,
      floorHit: leftover > 0,
    };
  }

  const current = weeks.find((w) => w.status === "current")!;
  const spentToday = spentOn(today, today);
  const spentBeforeToday = spentOn(current.start, addDays(today, -1));
  const daysLeftInWeek = daysBetween(today, current.end) + 1;
  const dailyPace = Math.floor(Math.max(0, current.budget - spentBeforeToday) / daysLeftInWeek);

  return {
    cycle: { ...cycle, days: cycleDays, dayIndex: daysBetween(cycle.start, today) },
    plan: { salary: plan.salary, bills, savings, spendable },
    weeks,
    today: {
      date: today,
      week: current,
      spendToday: dailyPace - spentToday,
      spentToday,
      dailyPace,
      leftThisWeek: current.budget - current.spent,
      daysLeftInWeek,
      strip: buildStrip(current, today, spentOn),
    },
    savings: { planned: savings, swept, borrowed, net: savings + swept - borrowed },
    warnings: rawSpendable < 0 ? ["overcommitted"] : [],
  };
}

function buildStrip(week: Week, today: ISODate, spentOn: (a: ISODate, b: ISODate) => Minor): DayCell[] {
  const monday = addDays(week.start, -weekday(week.start));
  const perDay = week.budget / week.days;
  let running = 0;
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const spent = date >= week.start && date <= week.end ? spentOn(date, date) : 0;
    running += spent;
    let state: DayState;
    if (date < week.start || date > week.end) state = "outside";
    else if (date === today) state = "today";
    else if (date > today) state = "upcoming";
    else if (spent <= perDay) state = "on";
    else state = running <= week.budget ? "covered" : "over";
    return { date, spent, state };
  });
}
