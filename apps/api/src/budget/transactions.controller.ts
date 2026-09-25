import { idParam, transactionInput, transactionPatch } from "@coinfidant/contracts";
import type { ISODate } from "@coinfidant/engine";
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
import { reclose, todayView } from "./cycles";
import { adjustableCycleOf, isActiveCategory, loadBudget, openCycleOf, todayFor, userPrefs } from "./load";

type Id = z.output<typeof idParam>;

/**
 * Transactions may be dated from the start of the last closed cycle (its adjustment window) up to today.
 * Anything older belongs to a locked cycle.
 */
async function window(ctx: BudgetCtx) {
  const { tx, userId, budgetId } = ctx;
  const [budget, open, adjustable, prefs] = await Promise.all([
    loadBudget(tx, budgetId),
    openCycleOf(tx, budgetId),
    adjustableCycleOf(tx, budgetId),
    userPrefs(tx, userId),
  ]);
  if (!budget || !open) throw new ConflictException({ error: "no_open_cycle" });
  const today = todayFor(prefs.timezone);
  const from = adjustable?.startDate ?? open.startDate;
  const inWindow = (d: ISODate) => d >= from && d <= today;
  const inClosed = (d: ISODate) => !!adjustable?.endDate && d >= adjustable.startDate && d <= adjustable.endDate;
  // Re-running the close keeps the stored snapshot true to the edited entries.
  const recloseIf = async (...dates: ISODate[]) => {
    if (adjustable && dates.some(inClosed)) await reclose(ctx, adjustable);
  };
  return { budget, today, inWindow, recloseIf, from };
}

@Controller("transactions")
export class TransactionsController {
  constructor(@Inject(BudgetScope) private readonly scope: BudgetScope) {}

  @Post()
  @HttpCode(201)
  create(@UserId() userId: string, @Body(new ZodPipe(transactionInput)) body: z.output<typeof transactionInput>) {
    return this.scope.run(userId, async (ctx) => {
      const { budget, today, inWindow, recloseIf } = await window(ctx);
      const date = body.date ?? today;
      if (!inWindow(date)) throw new BadRequestException({ error: "date_outside_cycle" });
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
      await recloseIf(date);
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
      const { budget, inWindow, recloseIf, from } = await window(ctx);
      const existing = await this.editable(ctx, id, from);
      if (body.date && !inWindow(body.date)) throw new BadRequestException({ error: "date_outside_cycle" });
      if (body.categoryId && !isActiveCategory(budget, body.categoryId)) {
        throw new BadRequestException({ error: "unknown_category" });
      }
      const { date, ...rest } = body;
      await ctx.tx
        .update(transactions)
        .set({ ...rest, ...(date && date !== existing.localDate ? { localDate: date } : {}) })
        .where(and(eq(transactions.id, id), eq(transactions.budgetId, ctx.budgetId)));
      await recloseIf(existing.localDate, date ?? existing.localDate);
      return todayView(ctx);
    });
  }

  @Delete(":id")
  remove(@UserId() userId: string, @Param(new ZodPipe(idParam)) { id }: Id) {
    return this.scope.run(userId, async (ctx) => {
      const { recloseIf, from } = await window(ctx);
      const existing = await this.editable(ctx, id, from);
      await ctx.tx.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.budgetId, ctx.budgetId)));
      await recloseIf(existing.localDate);
      return { today: await todayView(ctx) };
    });
  }

  private async editable({ tx, budgetId }: BudgetCtx, id: string, from: ISODate) {
    const [row] = await tx
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.budgetId, budgetId)));
    if (!row) throw new NotFoundException({ error: "not_found" });
    if (row.localDate < from) throw new ConflictException({ error: "cycle_locked" });
    return row;
  }
}
