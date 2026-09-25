import { type ClosedCycle, computeBadges, currentStreak, type ISODate, rateTrend } from "@coinfidant/engine";
import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { cycles, debts, goals, transactions } from "../db/schema";
import type { BudgetCtx } from "./budget.scope";
import { todayView } from "./cycles";

export async function growthView(ctx: BudgetCtx) {
  const { tx, budgetId } = ctx;
  const today = await todayView(ctx);
  const tz = today.prefs.timezone;

  const [closedRows, logs, [cleared], [reached]] = await Promise.all([
    tx
      .select({ startDate: cycles.startDate, endDate: cycles.endDate, snapshot: cycles.snapshot })
      .from(cycles)
      .where(and(eq(cycles.budgetId, budgetId), inArray(cycles.status, ["closed", "locked"])))
      .orderBy(asc(cycles.startDate)),
    tx
      .select({
        date: transactions.localDate,
        hour: sql<number>`extract(hour from ${transactions.occurredAt} at time zone ${tz})::int`,
      })
      .from(transactions)
      .where(and(eq(transactions.budgetId, budgetId), eq(transactions.type, "spend"))),
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(debts)
      .where(and(eq(debts.budgetId, budgetId), lte(debts.amountLeft, 0))),
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(goals)
      .where(and(eq(goals.budgetId, budgetId), gte(goals.saved, goals.target))),
  ]);

  const closed = closedRows.map((r) => r.snapshot as ClosedCycle);
  const todayDate = today.snapshot?.today.date ?? (new Date().toISOString().slice(0, 10) as ISODate);
  const recent = closedRows.slice(-4);

  return {
    rates: recent.map((r) => ({
      startDate: r.startDate,
      endDate: r.endDate,
      rateBp: (r.snapshot as ClosedCycle).savingsRateBp,
    })),
    trend: rateTrend(recent.map((r) => (r.snapshot as ClosedCycle).savingsRateBp)),
    streak: currentStreak(
      logs.map((l) => l.date),
      todayDate,
    ),
    badges: computeBadges({
      today: todayDate,
      closed,
      open: today.snapshot,
      logs,
      debtsCleared: cleared?.n ?? 0,
      goalsReached: reached?.n ?? 0,
    }),
  };
}
