import {
  preferencesInput,
  salaryInput,
  settingsInput,
  setupInput,
  sweepChoiceInput,
  weekParam,
} from "@coinfidant/contracts";
import { CATEGORIES, cycleStartFor, localDate } from "@coinfidant/engine";
import { Body, Controller, Get, HttpCode, Inject, NotFoundException, Param, Patch, Post, Put } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import { UserId } from "../auth/auth.guard";
import { ZodPipe } from "../common/zod.pipe";
import { ScopedDb, type Tx } from "../db/db.module";
import { bills, budgetMembers, budgets, categories, cycles, debts, incomes, sweepChoices, users } from "../db/schema";
import { BudgetScope, findBudgetId } from "./budget.scope";
import { receiveSalary, todayView } from "./cycles";
import { loadBudget, openCycleOf, userPrefs } from "./load";

type Setup = z.output<typeof setupInput>;

@Controller()
export class BudgetController {
  constructor(
    @Inject(BudgetScope) private readonly scope: BudgetScope,
    @Inject(ScopedDb) private readonly scoped: ScopedDb,
  ) {}

  @Get("budget")
  getBudget(@UserId() userId: string) {
    return this.scope.run(userId, async ({ tx, budgetId }) => ({
      budget: await loadBudget(tx, budgetId),
      prefs: await userPrefs(tx, userId),
      openCycle: await openCycleOf(tx, budgetId),
    }));
  }

  /** Creates the budget on first run; afterwards replaces the plan's basics (salary, payday, savings, bills). */
  @Post("budget/setup")
  setup(@UserId() userId: string, @Body(new ZodPipe(setupInput)) body: Setup) {
    return this.scoped.run(userId, async (tx) => {
      if (body.timezone) await tx.update(users).set({ timezone: body.timezone }).where(eq(users.id, userId));
      const existing = await findBudgetId(tx, userId);
      const budgetId = existing ?? (await createBudget(tx, userId, body));
      if (existing) await updateBasics(tx, budgetId, body);

      if (!(await openCycleOf(tx, budgetId))) {
        const { timezone } = await userPrefs(tx, userId);
        const start = body.lastSalaryOn ?? cycleStartFor(localDate(new Date(), timezone), body.expectedPayday);
        await tx.insert(cycles).values({ budgetId, startDate: start, salary: body.salary, status: "open" });
      }
      return { budget: await loadBudget(tx, budgetId), openCycle: await openCycleOf(tx, budgetId) };
    });
  }

  @Patch("budget/settings")
  settings(@UserId() userId: string, @Body(new ZodPipe(settingsInput)) body: z.output<typeof settingsInput>) {
    return this.scope.run(userId, async ({ tx, budgetId }) => {
      if (Object.keys(body).length) await tx.update(budgets).set(body).where(eq(budgets.id, budgetId));
      return { budget: await loadBudget(tx, budgetId) };
    });
  }

  @Patch("me/preferences")
  preferences(@UserId() userId: string, @Body(new ZodPipe(preferencesInput)) body: z.output<typeof preferencesInput>) {
    return this.scoped.run(userId, async (tx) => {
      if (Object.keys(body).length) await tx.update(users).set(body).where(eq(users.id, userId));
      return { prefs: await userPrefs(tx, userId) };
    });
  }

  @Get("today")
  today(@UserId() userId: string) {
    return this.scope.run(userId, (ctx) => todayView(ctx));
  }

  @Post("cycles/salary")
  @HttpCode(201)
  salary(@UserId() userId: string, @Body(new ZodPipe(salaryInput)) body: z.output<typeof salaryInput>) {
    return this.scope.run(userId, async (ctx) => {
      const { closed } = await receiveSalary(ctx, body);
      return { closed, today: await todayView(ctx) };
    });
  }

  /** Where a week's leftover goes: a debt, or savings when `debtId` is null. */
  @Put("cycles/current/sweeps/:week")
  sweep(
    @UserId() userId: string,
    @Param(new ZodPipe(weekParam)) { week }: z.output<typeof weekParam>,
    @Body(new ZodPipe(sweepChoiceInput)) { debtId }: z.output<typeof sweepChoiceInput>,
  ) {
    return this.scope.run(userId, async (ctx) => {
      const { tx, budgetId } = ctx;
      const cycle = await openCycleOf(tx, budgetId);
      if (!cycle) throw new NotFoundException({ error: "no_open_cycle" });
      if (debtId) {
        const [d] = await tx
          .select({ id: debts.id })
          .from(debts)
          .where(and(eq(debts.id, debtId), eq(debts.budgetId, budgetId)));
        if (!d) throw new NotFoundException({ error: "debt_not_found" });
      }
      await tx
        .insert(sweepChoices)
        .values({ budgetId, cycleId: cycle.id, weekIndex: week, debtId })
        .onConflictDoUpdate({ target: [sweepChoices.cycleId, sweepChoices.weekIndex], set: { debtId } });
      return todayView(ctx);
    });
  }
}

async function createBudget(tx: Tx, userId: string, body: Setup) {
  const [budget] = await tx
    .insert(budgets)
    .values({
      ownerId: userId,
      currency: body.currency,
      savingsPercent: body.savingsPercent,
      expectedPayday: body.expectedPayday,
    })
    .returning({ id: budgets.id });
  const budgetId = budget!.id;
  await tx.insert(budgetMembers).values({ budgetId, userId, role: "owner" });
  await tx.insert(incomes).values({ budgetId, name: "Salary", amount: body.salary, kind: "salary" });
  await tx
    .insert(categories)
    .values(CATEGORIES.map((c, position) => ({ budgetId, name: c.label, emoji: c.emoji, slug: c.key, position })));
  if (body.bills.length) await tx.insert(bills).values(body.bills.map((b) => ({ ...b, budgetId })));
  return budgetId;
}

async function updateBasics(tx: Tx, budgetId: string, body: Setup) {
  await tx
    .update(budgets)
    .set({ currency: body.currency, savingsPercent: body.savingsPercent, expectedPayday: body.expectedPayday })
    .where(eq(budgets.id, budgetId));
  await tx
    .update(incomes)
    .set({ amount: body.salary })
    .where(and(eq(incomes.budgetId, budgetId), eq(incomes.kind, "salary")));
  await tx.delete(bills).where(eq(bills.budgetId, budgetId));
  if (body.bills.length) await tx.insert(bills).values(body.bills.map((b) => ({ ...b, budgetId })));
  const open = await openCycleOf(tx, budgetId);
  if (open && open.salary !== body.salary)
    await tx.update(cycles).set({ salary: body.salary }).where(eq(cycles.id, open.id));
}
