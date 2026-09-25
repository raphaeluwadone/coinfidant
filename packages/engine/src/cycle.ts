import { spreadDeficit } from "./alloc";
import { dayOfWeek, projectedEnd, splitWeeks } from "./calendar";
import { addDays, daysBetween, type ISODate } from "./date";
import type { Minor } from "./money";
import { attackOrder } from "./phase";
import { computePlan } from "./plan";
import type {
  ClosedCycle,
  DayCell,
  DayState,
  EngineEvent,
  EngineInput,
  OpenCycle,
  Savings,
  SweepChoice,
  Week,
} from "./types";

export const ENGINE_VERSION = "1.0.0";

/** Grace days after the expected payday before overrun pacing stops stretching (R4). */
const SALARY_GRACE_DAYS = 2;

type Settled = {
  weeks: Week[];
  savings: Omit<Savings, "planned" | "net">;
  events: EngineEvent[];
  spentOn: (from: ISODate, to: ISODate) => Minor;
};

/**
 * Builds the weeks and settles every week that ended before `asOf` (R11, R12, R15–R17).
 * Transactions after `lastDay` are ignored; the final week stretches to `lastDay` when salary is late.
 */
function settleWeeks(input: EngineInput, projEnd: ISODate, flexible: Minor, lastDay: ISODate, asOf: ISODate): Settled {
  const { start } = input.cycle;
  const { weekStart, floorPercent } = input.settings;
  const cycleDays = daysBetween(start, projEnd) + 1;

  const spans = splitWeeks(start, projEnd, weekStart);
  if (lastDay > projEnd) spans[spans.length - 1]!.end = lastDay;

  const bases = spans.map((w) => Math.floor((flexible * w.days) / cycleDays));
  bases[bases.length - 1]! += flexible - bases.reduce((a, b) => a + b, 0);

  const txns = input.transactions.filter((t) => t.date >= start && t.date <= lastDay);
  const spentOn = (from: ISODate, to: ISODate) =>
    txns
      .filter((t) => t.date >= from && t.date <= to)
      .reduce((a, t) => a + (t.type === "refund" ? -t.amount : t.amount), 0);

  const weeks: Week[] = spans.map((w, index) => ({
    ...w,
    index,
    base: bases[index]!,
    floor: Math.round((bases[index]! * floorPercent) / 100),
    budget: bases[index]!,
    spent: spentOn(w.start, w.end),
    status: w.end < asOf ? "past" : w.start > asOf ? "future" : "current",
  }));

  const events: EngineEvent[] = [];
  const debtIds = new Set(input.debts.map((d) => d.id));
  const target = input.settings.leftoverDefault === "debts" ? attackOrder(input.debts)[0] : undefined;
  const fallback: SweepChoice = target ? { to: "debt", debtId: target.id } : { to: "savings" };
  const sweptToDebts = new Map<string, Minor>();
  let swept = 0;
  let borrowed = 0;

  for (const week of weeks) {
    if (week.status !== "past") break;
    if (week.spent <= week.budget) {
      const amount = week.budget - week.spent;
      const choice = input.sweepChoices[week.index] ?? fallback;
      if (choice?.to === "debt" && debtIds.has(choice.debtId)) {
        sweptToDebts.set(choice.debtId, (sweptToDebts.get(choice.debtId) ?? 0) + amount);
        week.outcome = { kind: "swept", amount, to: { debtId: choice.debtId } };
        events.push({ type: "sweep", week: week.index, amount, to: choice.debtId });
      } else {
        swept += amount;
        week.outcome = { kind: "swept", amount, to: "savings" };
        events.push({ type: "sweep", week: week.index, amount, to: "savings" });
      }
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
    const spread = deficit - leftover;
    week.outcome = { kind: "over", amount: deficit, spread, borrowed: leftover, floorHit: leftover > 0 };
    if (spread > 0) events.push({ type: "carryForward", week: week.index, amount: spread });
    if (leftover > 0) events.push({ type: "borrowedFromSavings", week: week.index, amount: leftover });
  }

  return {
    weeks,
    savings: { swept, borrowed, sweptToDebts: [...sweptToDebts].map(([debtId, amount]) => ({ debtId, amount })) },
    events,
    spentOn,
  };
}

export function computeOpenCycle(input: EngineInput): OpenCycle {
  const { today } = input;
  const { start } = input.cycle;
  const projEnd = projectedEnd(start, input.settings.expectedPayday);
  const overrunDays = Math.max(0, daysBetween(projEnd, today));
  const lastDay = overrunDays > 0 ? today : projEnd;

  const { plan, events: planEvents, suggestions } = computePlan(input, projEnd);
  const settled = settleWeeks(input, projEnd, plan.flexible, lastDay, today);
  const { weeks, spentOn } = settled;

  const current = weeks.find((w) => w.status === "current") ?? weeks[weeks.length - 1]!;
  const spentToday = spentOn(today, today);
  const spentBeforeToday = spentOn(current.start, addDays(today, -1));
  const daysLeftInWeek =
    overrunDays > 0
      ? Math.max(1, daysBetween(today, addDays(projEnd, 1 + SALARY_GRACE_DAYS)) + 1)
      : daysBetween(today, current.end) + 1;
  const dailyPace = Math.floor(Math.max(0, current.budget - spentBeforeToday) / daysLeftInWeek);

  const events = [...planEvents, ...settled.events];
  const daysLate = daysBetween(addDays(projEnd, 1), today);
  if (daysLate >= SALARY_GRACE_DAYS) events.push({ type: "salaryOverdue", daysLate });

  return {
    cycle: {
      start,
      projectedEnd: projEnd,
      days: daysBetween(start, projEnd) + 1,
      dayIndex: daysBetween(start, today),
      overrunDays,
    },
    plan,
    weeks,
    today: {
      date: today,
      week: current,
      spendToday: dailyPace - spentToday,
      spentToday,
      dailyPace,
      leftThisWeek: current.budget - current.spent,
      daysLeftInWeek,
      strip: buildStrip(current, today, input.settings.weekStart, spentOn),
    },
    savings: withNet(plan.savingsPlanned, settled.savings),
    suggestions,
    events,
  };
}

/** Settles the cycle that ends the day before `closedOn`, when the next salary was marked received. */
export function closeCycle(input: EngineInput, closedOn: ISODate): ClosedCycle {
  const { start, salary } = input.cycle;
  const projEnd = projectedEnd(start, input.settings.expectedPayday);
  const end = addDays(closedOn, -1);
  const lastDay = end > projEnd ? end : projEnd;

  const { plan, events: planEvents } = computePlan(input, projEnd);
  // Filtering to `end` means weeks after an early salary have no spending and sweep whole (R3).
  const settled = settleWeeks(
    { ...input, transactions: input.transactions.filter((t) => t.date <= end) },
    projEnd,
    plan.flexible,
    lastDay,
    addDays(lastDay, 1),
  );
  const savings = withNet(plan.savingsPlanned, settled.savings);

  const paid = (id: string) => input.debtPayments.filter((p) => p.debtId === id).reduce((a, p) => a + p.amount, 0);
  const sweptTo = (id: string) => settled.savings.sweptToDebts.find((s) => s.debtId === id)?.amount ?? 0;

  return {
    engineVersion: ENGINE_VERSION,
    cycle: { start, end, days: daysBetween(start, end) + 1 },
    plan,
    weeks: settled.weeks,
    spent: settled.weeks.reduce((a, w) => a + w.spent, 0),
    savings,
    savingsRateBp: salary > 0 ? Math.round((savings.net * 10_000) / salary) : 0,
    debts: input.debts.map((d) => {
      const due = plan.debts.find((x) => x.id === d.id)!.due;
      return {
        id: d.id,
        amountLeft: Math.max(0, d.amountLeft - paid(d.id) - sweptTo(d.id)),
        unpaid: Math.max(0, due - paid(d.id)),
      };
    }),
    sinkingFunds: input.sinkingFunds.map((f) => ({
      id: f.id,
      saved: f.saved + (plan.sinking.find((s) => s.id === f.id)?.setAside ?? 0),
    })),
    events: [...planEvents, ...settled.events],
  };
}

const withNet = (planned: Minor, s: Settled["savings"]): Savings => ({
  planned,
  ...s,
  net: planned + s.swept - s.borrowed,
});

function buildStrip(
  week: Week,
  today: ISODate,
  weekStart: EngineInput["settings"]["weekStart"],
  spentOn: (a: ISODate, b: ISODate) => Minor,
): DayCell[] {
  const spanEnd = week.end > today ? week.end : today;
  const perDay = week.budget / (daysBetween(week.start, spanEnd) + 1);
  const first = addDays(today, -dayOfWeek(today, weekStart));
  let running = 0;
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(first, i);
    const inWeek = date >= week.start && date <= spanEnd;
    const spent = inWeek ? spentOn(date, date) : 0;
    running += spent;
    let state: DayState;
    if (!inWeek) state = "outside";
    else if (date === today) state = "today";
    else if (date > today) state = "upcoming";
    else if (Math.max(0, spent) <= perDay) state = "on";
    else state = running <= week.budget ? "covered" : "over";
    return { date, spent: Math.max(0, spent), state };
  });
}

export const hasEvent = (s: { events: EngineEvent[] }, type: EngineEvent["type"]) =>
  s.events.some((e) => e.type === type);
