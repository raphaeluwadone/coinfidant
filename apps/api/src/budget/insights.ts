import {
  attackOrder,
  currentStreak,
  detectPhase,
  type EngineInput,
  generateInsights,
  type InsightKey,
  type OpenCycle,
  type Phase,
} from "@coinfidant/engine";
import { and, desc, eq } from "drizzle-orm";
import type { Tx } from "../db/db.module";
import { budgets, transactions } from "../db/schema";
import type { cycleTransactions, LoadedBudget } from "./load";

const ORDER: Phase[] = ["stabilise", "attack", "build"];

/**
 * Detects the phase and remembers it. An advance keeps `phaseFrom` set until the celebration has been shown;
 * a step back just updates quietly.
 */
export async function trackPhase(tx: Tx, budget: LoadedBudget, input: EngineInput, open: OpenCycle) {
  const reading = detectPhase(input, open);
  const stored = budget.phase as Phase | null;
  let from = budget.phaseFrom as Phase | null;
  if (stored !== reading.phase) {
    const advanced = stored !== null && ORDER.indexOf(reading.phase) > ORDER.indexOf(stored);
    from = advanced ? stored : null;
    await tx.update(budgets).set({ phase: reading.phase, phaseFrom: from }).where(eq(budgets.id, budget.id));
  }
  return { ...reading, celebrate: from ? { from, to: reading.phase } : null };
}

/** The current attack target by name, for Today's cards and insights. */
export function attackTarget(budget: LoadedBudget, input: EngineInput) {
  const t = attackOrder(input.debts)[0];
  const row = t && budget.debts.find((d) => d.id === t.id);
  return row ? { id: row.id, name: row.name, amountLeft: row.amountLeft, originalAmount: row.originalAmount } : null;
}

/**
 * The weekly sweep offer: last week's leftover when there's a debt it could go to and nobody has chosen yet.
 * Untouched weeks don't count; that leftover was never really there.
 */
export function sweepOffer(budget: LoadedBudget, input: EngineInput, open: OpenCycle) {
  const prev = open.weeks[open.today.week.index - 1];
  const target = attackTarget(budget, input);
  if (!prev || !target || prev.spent <= 0 || prev.index in input.sweepChoices) return null;
  if (prev.outcome?.kind !== "swept" || prev.outcome.amount <= 0) return null;
  const goal = budget.goals.find((g) => g.saved < g.target);
  return {
    week: prev.index,
    amount: prev.outcome.amount,
    target: { id: target.id, name: target.name },
    goal: goal ? { name: goal.name, emoji: goal.emoji } : null,
  };
}

export async function todayInsights(
  tx: Tx,
  budget: LoadedBudget,
  input: EngineInput,
  open: OpenCycle,
  txns: Awaited<ReturnType<typeof cycleTransactions>>,
  recent: InsightKey[],
) {
  const days = await tx
    .selectDistinct({ date: transactions.localDate })
    .from(transactions)
    .where(and(eq(transactions.budgetId, budget.id), eq(transactions.type, "spend")))
    .orderBy(desc(transactions.localDate))
    .limit(90);
  const dates = days.map((d) => d.date);
  const target = attackTarget(budget, input);
  return generateInsights({
    open,
    txns: txns.map((t) => ({ ...t, date: t.localDate, type: t.type as "spend" | "refund" })),
    categories: budget.categories,
    streak: currentStreak(dates, open.today.date),
    lastLogged: dates[0] ?? null,
    discovery: budget.discovery,
    target: target ? { name: target.name, amountLeft: target.amountLeft } : null,
    recent,
  });
}
