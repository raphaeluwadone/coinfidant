import {
  idParam,
  preferencesInput,
  salaryInput,
  settingsInput,
  setupInput,
  sweepChoiceInput,
  todayQuery,
  topUpInput,
  weekParam,
} from "@coinfidant/contracts";
import { cycleStartFor, localDate } from "@coinfidant/engine";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import type { z } from "zod";
import { UserId } from "../auth/auth.guard";
import { ZodPipe } from "../common/zod.pipe";
import { ScopedDb, type Tx } from "../db/db.module";
import { bills, budgets, commitments, cycles, cycleTopUps, debts, incomes, sweepChoices, users } from "../db/schema";
import { BudgetScope, findBudgetId } from "./budget.scope";
import { createBudget } from "./create";
import { growthView } from "./growth";
import { closedCycleView, historyView, receiveSalary, todayView } from "./cycles";
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
        await tx
          .insert(cycles)
          .values({ budgetId, startDate: start, salary: body.salary, status: "open", paydaySeenAt: new Date() });
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

  /** `recent` lists insight keys the viewer saw lately, so today's picks rotate. */
  @Get("today")
  today(@UserId() userId: string, @Query(new ZodPipe(todayQuery)) { recent }: z.output<typeof todayQuery>) {
    return this.scope.run(userId, (ctx) => todayView(ctx, new Date(), recent));
  }

  @Post("phase/celebrated")
  @HttpCode(204)
  celebrated(@UserId() userId: string) {
    return this.scope.run(userId, async ({ tx, budgetId }) => {
      await tx.update(budgets).set({ phaseFrom: null }).where(eq(budgets.id, budgetId));
    });
  }

  @Post("cycles/salary")
  @HttpCode(201)
  salary(@UserId() userId: string, @Body(new ZodPipe(salaryInput)) body: z.output<typeof salaryInput>) {
    return this.scope.run(userId, async (ctx) => {
      const { closed, closedCycleId, learned } = await receiveSalary(ctx, body);
      return { closed, closedCycleId, learned, today: await todayView(ctx) };
    });
  }

  @Get("growth")
  growth(@UserId() userId: string) {
    return this.scope.run(userId, (ctx) => growthView(ctx));
  }

  @Get("cycles/history")
  history(@UserId() userId: string) {
    return this.scope.run(userId, async (ctx) => ({ cycles: await historyView(ctx) }));
  }

  @Get("cycles/:id")
  cycle(@UserId() userId: string, @Param(new ZodPipe(idParam)) { id }: z.output<typeof idParam>) {
    return this.scope.run(userId, (ctx) => closedCycleView(ctx, id));
  }

  @Post("cycles/current/payday-seen")
  @HttpCode(204)
  paydaySeen(@UserId() userId: string) {
    return this.scope.run(userId, async ({ tx, budgetId }) => {
      await tx
        .update(cycles)
        .set({ paydaySeenAt: new Date() })
        .where(and(eq(cycles.budgetId, budgetId), eq(cycles.status, "open"), isNull(cycles.paydaySeenAt)));
    });
  }

  /** R24: accept a top-up toward a supported person's or flexible debt's ideal for this cycle; 0 removes it. */
  @Put("cycles/current/top-ups/:id")
  topUp(
    @UserId() userId: string,
    @Param(new ZodPipe(idParam)) { id }: z.output<typeof idParam>,
    @Body(new ZodPipe(topUpInput)) { amount }: z.output<typeof topUpInput>,
  ) {
    return this.scope.run(userId, async (ctx) => {
      const { tx, budgetId } = ctx;
      const cycle = await openCycleOf(tx, budgetId);
      if (!cycle) throw new NotFoundException({ error: "no_open_cycle" });

      const [commitment] = await tx
        .select()
        .from(commitments)
        .where(and(eq(commitments.id, id), eq(commitments.budgetId, budgetId)));
      const [debt] = commitment
        ? []
        : await tx
            .select()
            .from(debts)
            .where(and(eq(debts.id, id), eq(debts.budgetId, budgetId), eq(debts.plan, "flexible")));
      if (!commitment && !debt) throw new NotFoundException({ error: "not_found" });

      const gap = commitment
        ? commitment.idealAmount - commitment.minAmount
        : Math.min(debt!.idealAmount ?? 0, debt!.amountLeft) - Math.min(debt!.minAmount ?? 0, debt!.amountLeft);
      if (amount > gap) throw new BadRequestException({ error: "above_ideal", max: Math.max(0, gap) });

      const where = and(eq(cycleTopUps.cycleId, cycle.id), eq(cycleTopUps.itemId, id));
      if (amount === 0) await tx.delete(cycleTopUps).where(where);
      else
        await tx
          .insert(cycleTopUps)
          .values({ budgetId, cycleId: cycle.id, itemKind: commitment ? "commitment" : "debt", itemId: id, amount })
          .onConflictDoUpdate({ target: [cycleTopUps.cycleId, cycleTopUps.itemId], set: { amount } });
      return todayView(ctx);
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
