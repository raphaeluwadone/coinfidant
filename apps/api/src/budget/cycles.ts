import {
  addDays,
  type ClosedCycle,
  closeCycle,
  computeOpenCycle,
  daysBetween,
  discoveryProgress,
  type EngineInput,
  type InsightKey,
  type ISODate,
  stakesHigh,
} from "@coinfidant/engine";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { budgets, cycles, debts, sinkingFunds } from "../db/schema";
import type { BudgetCtx } from "./budget.scope";
import { attackTarget, sweepOffer, todayInsights, trackPhase } from "./insights";
import {
  activeCategories,
  adjustableCycleOf,
  cycleActivity,
  cycleTransactions,
  engineInput,
  type LoadedBudget,
  loadBudget,
  openCycleOf,
  todayFor,
  userPrefs,
} from "./load";

export type Learned = {
  categories: { categoryId: string; name: string; emoji: string; monthly: number }[];
  total: number;
};

export async function todayView(ctx: BudgetCtx, now = new Date(), recent: InsightKey[] = []) {
  const { tx, userId, budgetId } = ctx;
  const [budget, prefs, cycle] = await Promise.all([
    loadBudget(tx, budgetId),
    userPrefs(tx, userId),
    openCycleOf(tx, budgetId),
  ]);
  if (!budget) throw new NotFoundException({ error: "no_budget" });
  const base = {
    prefs,
    currency: budget.currency,
    categories: activeCategories(budget),
    budget: { paydayMode: budget.paydayMode, discovery: budget.discovery, everydayEstimate: budget.everydayEstimate },
  };
  if (!cycle)
    return {
      ...base,
      cycle: null,
      snapshot: null,
      transactions: [],
      discovery: null,
      adjustable: null,
      stakes: false,
      phase: null,
      target: null,
      sweepOffer: null,
      insights: [],
      debtPayments: [],
      lastRateBp: null,
    };

  const today = todayFor(prefs.timezone, now);
  const { input, txns } = await engineInput(tx, budget, cycle, today);
  const snapshot = computeOpenCycle(input);
  const last = await adjustableCycleOf(tx, budgetId);
  const borrowedLastCycle = ((last?.snapshot as ClosedCycle | null)?.savings.borrowed ?? 0) > 0;
  const discovery = budget.discovery
    ? discoveryProgress(
        txns.map((t) => ({ ...t, date: t.localDate, type: t.type as "spend" | "refund" })),
        { start: cycle.startDate, days: snapshot.cycle.days },
        today,
      )
    : null;

  return {
    ...base,
    cycle: { id: cycle.id, startDate: cycle.startDate, salary: cycle.salary, paydaySeenAt: cycle.paydaySeenAt },
    snapshot,
    transactions: txns,
    topUps: input.topUps ?? [],
    debtPayments: input.debtPayments,
    discovery,
    adjustable: await adjustableView(ctx),
    // Stakes override (M6): repeated savings drains switch every tone to the warm voice.
    stakes: stakesHigh(snapshot, { borrowedLastCycle }),
    phase: await trackPhase(tx, budget, input, snapshot),
    target: attackTarget(budget, input),
    sweepOffer: sweepOffer(budget, input, snapshot),
    insights: await todayInsights(tx, budget, input, snapshot, txns, recent),
    // Build's hero compares against it ("Up from 29% last cycle").
    lastRateBp: (last?.snapshot as ClosedCycle | null)?.savingsRateBp ?? null,
  };
}

function learnedFrom(
  budget: LoadedBudget,
  txns: Awaited<ReturnType<typeof engineInput>>["txns"],
  start: ISODate,
  end: ISODate,
): Learned {
  const days = daysBetween(start, end) + 1;
  const final = discoveryProgress(
    txns.map((t) => ({ ...t, date: t.localDate, type: t.type as "spend" | "refund" })),
    { start, days },
    end,
    { final: true },
  );
  const categories = final.categories.map((c) => {
    const cat = budget.categories.find((x) => x.id === c.categoryId);
    return { categoryId: c.categoryId, name: cat?.name ?? "Other", emoji: cat?.emoji ?? "✨", monthly: c.monthly ?? 0 };
  });
  return { categories, total: final.categories.reduce((a, c) => a + c.spent, 0) };
}

/**
 * Opens the cycle that starts on `receivedOn`, first closing the open one (R3). Marking the same day twice is a no-op.
 * TODO(M5): adjustment window, locking the cycle before last, re-running closes after edits.
 */
export async function receiveSalary(ctx: BudgetCtx, body: { amount?: number; receivedOn?: ISODate }, now = new Date()) {
  const { tx, userId, budgetId } = ctx;
  const [budget, prefs, open] = await Promise.all([
    loadBudget(tx, budgetId),
    userPrefs(tx, userId),
    openCycleOf(tx, budgetId),
  ]);
  if (!budget) throw new NotFoundException({ error: "no_budget" });

  const today = todayFor(prefs.timezone, now);
  const receivedOn = body.receivedOn ?? today;
  if (receivedOn > today) throw new BadRequestException({ error: "future_date" });
  const amount = body.amount ?? budget.incomes.find((i) => i.kind === "salary")?.amount;
  if (!amount) throw new BadRequestException({ error: "salary_amount_required" });

  if (open?.startDate === receivedOn) {
    if (body.amount && body.amount !== open.salary) {
      await tx.update(cycles).set({ salary: body.amount }).where(eq(cycles.id, open.id));
    }
    return { cycleId: open.id, closedCycleId: null, closed: null, learned: null };
  }
  if (open && receivedOn <= open.startDate) throw new ConflictException({ error: "before_open_cycle" });

  let closed: ClosedCycle | null = null;
  let learned: Learned | null = null;
  if (open) {
    // The cycle before last leaves its adjustment window now.
    await tx
      .update(cycles)
      .set({ status: "locked" })
      .where(and(eq(cycles.budgetId, budgetId), eq(cycles.status, "closed")));

    const end = addDays(receivedOn, -1);
    const { input, txns } = await engineInput(tx, budget, open, end, end);
    closed = closeCycle(input, receivedOn);
    if (budget.discovery) learned = learnedFrom(budget, txns, open.startDate, end);

    await tx
      .update(cycles)
      .set({
        status: "closed",
        endDate: closed.cycle.end,
        snapshot: closed,
        engineVersion: closed.engineVersion,
        closedAt: now,
        learned,
        closeInput: input,
      })
      .where(eq(cycles.id, open.id));
    for (const d of closed.debts) {
      await tx
        .update(debts)
        .set({ amountLeft: d.amountLeft })
        .where(and(eq(debts.id, d.id), eq(debts.budgetId, budgetId)));
    }
    for (const f of closed.sinkingFunds) {
      await tx
        .update(sinkingFunds)
        .set({ saved: f.saved })
        .where(and(eq(sinkingFunds.id, f.id), eq(sinkingFunds.budgetId, budgetId)));
    }
    // R25: a finished discovery cycle hands its real spending to the plan and judgment returns.
    if (learned) {
      await tx
        .update(budgets)
        // Nothing logged means nothing learned: keep the estimate unset rather than claiming NGN 0.
        .set({ discovery: false, everydayEstimate: learned.total > 0 ? learned.total : null })
        .where(eq(budgets.id, budgetId));
    }
  }

  const [created] = await tx
    .insert(cycles)
    .values({
      budgetId,
      startDate: receivedOn,
      salary: amount,
      status: "open",
      paydaySeenAt: budget.paydayMode ? null : now,
    })
    .returning({ id: cycles.id });
  return { cycleId: created!.id, closedCycleId: open?.id ?? null, closed, learned };
}

/**
 * Re-runs a closed cycle after an edit in its adjustment window. The plan it closed on is kept; only what happened
 * (transactions, payments, sweeps, top-ups) is re-read. Balances move by the change between old and new snapshots, so
 * anything done since the close isn't overwritten.
 */
export async function reclose(ctx: BudgetCtx, cycle: NonNullable<Awaited<ReturnType<typeof adjustableCycleOf>>>) {
  const { tx, budgetId } = ctx;
  const stored = cycle.closeInput as EngineInput | null;
  const before = cycle.snapshot as ClosedCycle | null;
  if (!stored || !before || !cycle.endDate) return null;

  const { activity, txns } = await cycleActivity(tx, budgetId, cycle, cycle.endDate);
  const input: EngineInput = { ...stored, ...activity };
  const after = closeCycle(input, addDays(cycle.endDate, 1));

  for (const d of after.debts) {
    const delta = d.amountLeft - (before.debts.find((x) => x.id === d.id)?.amountLeft ?? d.amountLeft);
    if (!delta) continue;
    await tx
      .update(debts)
      .set({ amountLeft: sql`greatest(0, ${debts.amountLeft} + ${delta})` })
      .where(and(eq(debts.id, d.id), eq(debts.budgetId, budgetId)));
  }

  let learned = cycle.learned as Learned | null;
  if (learned) {
    const budget = await loadBudget(tx, budgetId);
    learned = learnedFrom(budget!, txns, cycle.startDate, cycle.endDate);
    await tx
      .update(budgets)
      .set({ everydayEstimate: learned.total > 0 ? learned.total : null })
      .where(eq(budgets.id, budgetId));
  }

  await tx
    .update(cycles)
    .set({ snapshot: after, engineVersion: after.engineVersion, closeInput: input, learned })
    .where(eq(cycles.id, cycle.id));
  return after;
}

/** The last closed cycle's entries while they can still be edited. */
export async function adjustableView(ctx: BudgetCtx) {
  const cycle = await adjustableCycleOf(ctx.tx, ctx.budgetId);
  if (!cycle?.endDate) return null;
  return {
    cycleId: cycle.id,
    startDate: cycle.startDate,
    endDate: cycle.endDate,
    transactions: await cycleTransactions(ctx.tx, ctx.budgetId, cycle.startDate, cycle.endDate),
  };
}

export async function historyView(ctx: BudgetCtx) {
  const rows = await ctx.tx
    .select({
      id: cycles.id,
      startDate: cycles.startDate,
      endDate: cycles.endDate,
      status: cycles.status,
      snapshot: cycles.snapshot,
    })
    .from(cycles)
    .where(and(eq(cycles.budgetId, ctx.budgetId), inArray(cycles.status, ["closed", "locked"])))
    .orderBy(desc(cycles.startDate))
    .limit(24);
  return rows.map((r) => {
    const s = r.snapshot as ClosedCycle;
    return {
      id: r.id,
      startDate: r.startDate,
      endDate: r.endDate,
      status: r.status,
      savingsRateBp: s.savingsRateBp,
      saved: s.savings.net,
      spent: s.spent,
    };
  });
}

export async function closedCycleView(ctx: BudgetCtx, id: string) {
  const [row] = await ctx.tx
    .select()
    .from(cycles)
    .where(and(eq(cycles.id, id), eq(cycles.budgetId, ctx.budgetId), inArray(cycles.status, ["closed", "locked"])));
  if (!row) throw new NotFoundException({ error: "not_found" });
  const budget = await loadBudget(ctx.tx, ctx.budgetId);
  const s = row.snapshot as ClosedCycle;
  const name = (debtId: string) => budget!.debts.find((d) => d.id === debtId)?.name ?? "A debt";
  return {
    id: row.id,
    status: row.status,
    startDate: row.startDate,
    endDate: row.endDate,
    snapshot: s,
    pendingDebts: s.debts.filter((d) => d.unpaid > 0).map((d) => ({ ...d, name: name(d.id) })),
    sweptToDebts: s.savings.sweptToDebts.map((d) => ({ ...d, name: name(d.debtId) })),
  };
}
