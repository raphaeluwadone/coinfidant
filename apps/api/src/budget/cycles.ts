import { addDays, closeCycle, computeOpenCycle, type ISODate } from "@coinfidant/engine";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { BudgetCtx } from "./budget.scope";
import { cycles, debts, sinkingFunds } from "../db/schema";
import { activeCategories, engineInput, loadBudget, openCycleOf, todayFor, userPrefs } from "./load";

export async function todayView(ctx: BudgetCtx, now = new Date()) {
  const { tx, userId, budgetId } = ctx;
  const [budget, prefs, cycle] = await Promise.all([
    loadBudget(tx, budgetId),
    userPrefs(tx, userId),
    openCycleOf(tx, budgetId),
  ]);
  if (!budget) throw new NotFoundException({ error: "no_budget" });
  const base = { prefs, currency: budget.currency, categories: activeCategories(budget) };
  if (!cycle) return { ...base, cycle: null, snapshot: null, transactions: [] };

  const today = todayFor(prefs.timezone, now);
  const { input, txns } = await engineInput(tx, budget, cycle, today);
  return {
    ...base,
    cycle: { id: cycle.id, startDate: cycle.startDate, salary: cycle.salary },
    snapshot: computeOpenCycle(input),
    transactions: txns,
  };
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
    return { cycleId: open.id, closed: null };
  }
  if (open && receivedOn <= open.startDate) throw new ConflictException({ error: "before_open_cycle" });

  let closed: ReturnType<typeof closeCycle> | null = null;
  if (open) {
    const end = addDays(receivedOn, -1);
    const { input } = await engineInput(tx, budget, open, end, end);
    closed = closeCycle(input, receivedOn);
    await tx
      .update(cycles)
      .set({
        status: "closed",
        endDate: closed.cycle.end,
        snapshot: closed,
        engineVersion: closed.engineVersion,
        closedAt: now,
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
  }

  const [created] = await tx
    .insert(cycles)
    .values({ budgetId, startDate: receivedOn, salary: amount, status: "open" })
    .returning({ id: cycles.id });
  return { cycleId: created!.id, closed };
}
