import { idParam, transactionInput, transactionPatch } from "@coinfidant/contracts";
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import { UserId } from "../auth/auth.guard";
import { ZodPipe } from "../common/zod.pipe";
import { transactions } from "../db/schema";
import { type BudgetCtx, BudgetScope } from "./budget.scope";
import { todayView } from "./cycles";
import { isActiveCategory, loadBudget, openCycleOf, todayFor, userPrefs } from "./load";

type Id = z.output<typeof idParam>;

/** The open cycle and today's date; transactions may only be dated inside that window. */
async function window({ tx, userId, budgetId }: BudgetCtx) {
  const [budget, cycle, prefs] = await Promise.all([
    loadBudget(tx, budgetId),
    openCycleOf(tx, budgetId),
    userPrefs(tx, userId),
  ]);
  if (!budget || !cycle) throw new ConflictException({ error: "no_open_cycle" });
  return { budget, cycle, timezone: prefs.timezone, today: todayFor(prefs.timezone) };
}

// TODO(M5): allow edits in the just-closed cycle during its adjustment window.
@Controller("transactions")
export class TransactionsController {
  constructor(@Inject(BudgetScope) private readonly scope: BudgetScope) {}

  @Post()
  @HttpCode(201)
  create(@UserId() userId: string, @Body(new ZodPipe(transactionInput)) body: z.output<typeof transactionInput>) {
    return this.scope.run(userId, async (ctx) => {
      const { budget, cycle, today } = await window(ctx);
      const date = body.date ?? today;
      if (date < cycle.startDate || date > today) throw new BadRequestException({ error: "date_outside_cycle" });
      if (!isActiveCategory(budget, body.categoryId)) throw new BadRequestException({ error: "unknown_category" });

      // Back-dated entries keep their date; noon avoids them landing on another day in the user's timezone.
      const occurredAt = body.date && body.date !== today ? new Date(`${date}T12:00:00Z`) : new Date();
      const [transaction] = await ctx.tx
        .insert(transactions)
        .values({
          budgetId: ctx.budgetId,
          createdBy: userId,
          amount: body.amount,
          type: body.type,
          categoryId: body.categoryId,
          note: body.note,
          occurredAt,
          localDate: date,
        })
        .returning();
      return { transaction, today: await todayView(ctx) };
    });
  }

  @Patch(":id")
  update(
    @UserId() userId: string,
    @Param(new ZodPipe(idParam)) { id }: Id,
    @Body(new ZodPipe(transactionPatch)) body: z.output<typeof transactionPatch>,
  ) {
    if (!Object.keys(body).length) throw new BadRequestException({ error: "empty_update" });
    return this.scope.run(userId, async (ctx) => {
      const { budget, cycle, today } = await window(ctx);
      const existing = await this.inOpenCycle(ctx, id, cycle.startDate);
      if (body.date && (body.date < cycle.startDate || body.date > today)) {
        throw new BadRequestException({ error: "date_outside_cycle" });
      }
      if (body.categoryId && !isActiveCategory(budget, body.categoryId)) {
        throw new BadRequestException({ error: "unknown_category" });
      }
      const { date, ...rest } = body;
      await ctx.tx
        .update(transactions)
        .set({ ...rest, ...(date && date !== existing.localDate ? { localDate: date } : {}) })
        .where(and(eq(transactions.id, id), eq(transactions.budgetId, ctx.budgetId)));
      return todayView(ctx);
    });
  }

  @Delete(":id")
  remove(@UserId() userId: string, @Param(new ZodPipe(idParam)) { id }: Id) {
    return this.scope.run(userId, async (ctx) => {
      const { cycle } = await window(ctx);
      await this.inOpenCycle(ctx, id, cycle.startDate);
      await ctx.tx.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.budgetId, ctx.budgetId)));
      return { today: await todayView(ctx) };
    });
  }

  private async inOpenCycle({ tx, budgetId }: BudgetCtx, id: string, cycleStart: string) {
    const [row] = await tx
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.budgetId, budgetId)));
    if (!row) throw new NotFoundException({ error: "not_found" });
    if (row.localDate < cycleStart) throw new ConflictException({ error: "cycle_closed" });
    return row;
  }
}
