import {
  addDays,
  closeCycle,
  computeOpenCycle,
  daysBetween,
  discoveryProgress,
  type ISODate,
} from "@coinfidant/engine";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { budgets, cycles, debts, sinkingFunds } from "../db/schema";
import type { BudgetCtx } from "./budget.scope";
import { activeCategories, engineInput, type LoadedBudget, loadBudget, openCycleOf, todayFor, userPrefs } from "./load";

export type Learned = {
  categories: { categoryId: string; name: string; emoji: string; monthly: number }[];
  total: number;
};

export async function todayView(ctx: BudgetCtx, now = new Date()) {
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
  if (!cycle) return { ...base, cycle: null, snapshot: null, transactions: [], discovery: null };

  const today = todayFor(prefs.timezone, now);
  const { input, txns } = await engineInput(tx, budget, cycle, today);
  const snapshot = computeOpenCycle(input);
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
    discovery,
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
    return { cycleId: open.id, closed: null, learned: null };
  }
  if (open && receivedOn <= open.startDate) throw new ConflictException({ error: "before_open_cycle" });

  let closed: ReturnType<typeof closeCycle> | null = null;
  let learned: Learned | null = null;
  if (open) {
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
  return { cycleId: created!.id, closed, learned };
}
