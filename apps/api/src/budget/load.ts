import {
  type Debt,
  type EngineInput,
  type ISODate,
  localDate,
  type SweepChoice,
  type WeekStart,
} from "@coinfidant/engine";
import { and, asc, between, desc, eq, sql } from "drizzle-orm";
import type { Tx } from "../db/db.module";
import {
  bills,
  budgets,
  categories,
  commitments,
  cycles,
  cycleTopUps,
  debtPayments,
  debts,
  goals,
  incomes,
  sinkingFunds,
  sweepChoices,
  transactions,
  users,
} from "../db/schema";

// Every query also filters by budget_id: RLS is the safety net, not the only check.

export async function loadBudget(tx: Tx, budgetId: string) {
  const [budget] = await tx.select().from(budgets).where(eq(budgets.id, budgetId)).limit(1);
  if (!budget) return null;
  const [incomeRows, billRows, fundRows, debtRows, commitmentRows, categoryRows, goalRows] = await Promise.all([
    tx.select().from(incomes).where(eq(incomes.budgetId, budgetId)).orderBy(asc(incomes.name)),
    tx.select().from(bills).where(eq(bills.budgetId, budgetId)).orderBy(asc(bills.name)),
    tx
      .select()
      .from(sinkingFunds)
      .where(eq(sinkingFunds.budgetId, budgetId))
      .orderBy(sql`${sinkingFunds.dueDate} asc nulls last`),
    tx.select().from(debts).where(eq(debts.budgetId, budgetId)).orderBy(asc(debts.createdAt)),
    tx.select().from(commitments).where(eq(commitments.budgetId, budgetId)).orderBy(asc(commitments.name)),
    tx
      .select()
      .from(categories)
      .where(eq(categories.budgetId, budgetId))
      .orderBy(asc(categories.position), asc(categories.name)),
    tx.select().from(goals).where(eq(goals.budgetId, budgetId)).orderBy(asc(goals.createdAt)),
  ]);
  return {
    ...budget,
    incomes: incomeRows,
    bills: billRows,
    sinkingFunds: fundRows,
    debts: debtRows,
    commitments: commitmentRows,
    categories: categoryRows,
    goals: goalRows,
  };
}
export type LoadedBudget = NonNullable<Awaited<ReturnType<typeof loadBudget>>>;

export const openCycleOf = (tx: Tx, budgetId: string) =>
  tx
    .select()
    .from(cycles)
    .where(and(eq(cycles.budgetId, budgetId), eq(cycles.status, "open")))
    .limit(1)
    .then((r) => r[0] ?? null);
export type CycleRow = NonNullable<Awaited<ReturnType<typeof openCycleOf>>>;

export async function userPrefs(tx: Tx, userId: string) {
  const [u] = await tx
    .select({
      timezone: users.timezone,
      personality: users.personality,
      displayName: users.displayName,
      checkinMethod: users.checkinMethod,
      leakCategories: users.leakCategories,
      overspendTimes: users.overspendTimes,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u) throw new Error(`user ${userId} not found`);
  return u;
}

export function cycleTransactions(tx: Tx, budgetId: string, from: ISODate, to: ISODate) {
  return tx
    .select({
      id: transactions.id,
      amount: transactions.amount,
      type: transactions.type,
      note: transactions.note,
      occurredAt: transactions.occurredAt,
      localDate: transactions.localDate,
      categoryId: transactions.categoryId,
      category: { name: categories.name, emoji: categories.emoji, slug: categories.slug },
    })
    .from(transactions)
    .innerJoin(categories, eq(categories.id, transactions.categoryId))
    .where(and(eq(transactions.budgetId, budgetId), between(transactions.localDate, from, to)))
    .orderBy(asc(transactions.occurredAt));
}

const debtPlan = (d: LoadedBudget["debts"][number]): Debt["plan"] => {
  switch (d.plan) {
    case "oneOff":
      return { kind: "oneOff", due: d.dueDate! };
    case "installments":
      return { kind: "installments", perCycle: d.perCycle! };
    default:
      return { kind: "flexible", min: d.minAmount ?? 0, ideal: d.idealAmount ?? 0 };
  }
};

/** What happened during a cycle up to `to`: the parts of the engine input that change as you log. */
export async function cycleActivity(tx: Tx, budgetId: string, cycle: Pick<CycleRow, "id" | "startDate">, to: ISODate) {
  const [txns, payments, sweeps, topUps] = await Promise.all([
    cycleTransactions(tx, budgetId, cycle.startDate, to),
    tx
      .select()
      .from(debtPayments)
      .where(and(eq(debtPayments.budgetId, budgetId), eq(debtPayments.cycleId, cycle.id))),
    tx
      .select()
      .from(sweepChoices)
      .where(and(eq(sweepChoices.budgetId, budgetId), eq(sweepChoices.cycleId, cycle.id))),
    tx
      .select()
      .from(cycleTopUps)
      .where(and(eq(cycleTopUps.budgetId, budgetId), eq(cycleTopUps.cycleId, cycle.id))),
  ]);

  const sweepMap: Record<number, SweepChoice> = {};
  for (const s of sweeps) sweepMap[s.weekIndex] = s.debtId ? { to: "debt", debtId: s.debtId } : { to: "savings" };

  const activity: Pick<EngineInput, "transactions" | "sweepChoices" | "debtPayments" | "topUps"> = {
    transactions: txns.map((t) => ({
      id: t.id,
      amount: t.amount,
      date: t.localDate,
      type: t.type as "spend" | "refund",
    })),
    sweepChoices: sweepMap,
    debtPayments: payments.map((p) => ({ debtId: p.debtId, amount: p.amount })),
    topUps: topUps.map((t) => ({ id: t.itemId, amount: t.amount })),
  };
  return { activity, txns };
}

/** Everything the engine needs for one cycle, read from the database. */
export async function engineInput(
  tx: Tx,
  budget: LoadedBudget,
  cycle: CycleRow,
  today: ISODate,
  lastDay: ISODate = today,
): Promise<{ input: EngineInput; txns: Awaited<ReturnType<typeof cycleTransactions>> }> {
  const { activity, txns } = await cycleActivity(tx, budget.id, cycle, lastDay);
  const input: EngineInput = {
    today,
    settings: {
      savingsPercent: budget.savingsPercent,
      minSavingsPercent: budget.minSavingsPercent,
      floorPercent: budget.floorPercent,
      weekStart: budget.weekStart as WeekStart,
      expectedPayday: budget.expectedPayday,
      everydayEstimate: budget.everydayEstimate,
      leftoverDefault: budget.leftoverDefault as "savings" | "debts",
    },
    cycle: { start: cycle.startDate, salary: cycle.salary },
    bills: budget.bills.map((b) => ({ id: b.id, name: b.name, amount: b.amount })),
    sinkingFunds: budget.sinkingFunds.map((f) => ({
      id: f.id,
      name: f.name,
      target: f.target,
      saved: f.saved,
      due: f.dueDate,
      perCycle: f.perCycle,
    })),
    debts: budget.debts.map((d) => ({
      id: d.id,
      name: d.name,
      creditor: d.creditor,
      amountLeft: d.amountLeft,
      hasInterest: d.hasInterest,
      aprBp: d.aprBp,
      plan: debtPlan(d),
    })),
    commitments: budget.commitments.map((c) => ({ id: c.id, name: c.name, min: c.minAmount, ideal: c.idealAmount })),
    ...activity,
  };
  return { input, txns };
}

/** The most recent closed cycle, which stays editable until the next one closes. */
export const adjustableCycleOf = (tx: Tx, budgetId: string) =>
  tx
    .select()
    .from(cycles)
    .where(and(eq(cycles.budgetId, budgetId), eq(cycles.status, "closed")))
    .orderBy(desc(cycles.startDate))
    .limit(1)
    .then((r) => r[0] ?? null);

export const todayFor = (timezone: string, now = new Date()) => localDate(now, timezone);

export const activeCategories = (b: LoadedBudget) => b.categories.filter((c) => !c.archivedAt);
export const isActiveCategory = (b: LoadedBudget, id: string) => activeCategories(b).some((c) => c.id === id);
