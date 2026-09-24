import {
  billInput,
  commitmentInput,
  debtInput,
  debtPaymentInput,
  idParam,
  incomeInput,
  sinkingFundInput,
} from "@coinfidant/contracts";
import {
  BadRequestException,
  Body,
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
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import type { z } from "zod";
import { UserId } from "../auth/auth.guard";
import { ZodPipe } from "../common/zod.pipe";
import { bills, commitments, debtPayments, debts, incomes, sinkingFunds } from "../db/schema";
import { BudgetScope } from "./budget.scope";
import { openCycleOf, todayFor, userPrefs } from "./load";

type Id = z.output<typeof idParam>;
type Owned = PgTable & { id: AnyPgColumn; budgetId: AnyPgColumn };

const debtRow = (d: z.output<typeof debtInput>) => ({
  name: d.name,
  creditor: d.creditor,
  amountLeft: d.amountLeft,
  hasInterest: d.hasInterest,
  plan: d.plan.kind,
  dueDate: d.plan.kind === "oneOff" ? d.plan.due : null,
  perCycle: d.plan.kind === "installments" ? d.plan.perCycle : null,
  minAmount: d.plan.kind === "flexible" ? d.plan.min : null,
  idealAmount: d.plan.kind === "flexible" ? d.plan.ideal : null,
});

const commitmentRow = (c: z.output<typeof commitmentInput>) => ({
  name: c.name,
  minAmount: c.min,
  idealAmount: c.ideal,
});

@Controller()
export class ItemsController {
  constructor(@Inject(BudgetScope) private readonly scope: BudgetScope) {}

  private create(userId: string, table: Owned, values: object) {
    return this.scope.run(userId, async ({ tx, budgetId }) => {
      const [row] = await tx
        .insert(table)
        .values({ ...values, budgetId } as never)
        .returning();
      return { item: row };
    });
  }

  private update(userId: string, table: Owned, id: string, values: object) {
    if (!Object.keys(values).length) throw new BadRequestException({ error: "empty_update" });
    return this.scope.run(userId, async ({ tx, budgetId }) => {
      const [row] = await tx
        .update(table)
        .set(values as never)
        .where(and(eq(table.id, id), eq(table.budgetId, budgetId)))
        .returning();
      if (!row) throw new NotFoundException({ error: "not_found" });
      return { item: row };
    });
  }

  private remove(userId: string, table: Owned, id: string) {
    return this.scope.run(userId, async ({ tx, budgetId }) => {
      const gone = await tx
        .delete(table)
        .where(and(eq(table.id, id), eq(table.budgetId, budgetId)))
        .returning({ id: table.id });
      if (!gone.length) throw new NotFoundException({ error: "not_found" });
    });
  }

  @Post("bills") createBill(@UserId() u: string, @Body(new ZodPipe(billInput)) b: z.output<typeof billInput>) {
    return this.create(u, bills, b);
  }
  @Patch("bills/:id") updateBill(
    @UserId() u: string,
    @Param(new ZodPipe(idParam)) p: Id,
    @Body(new ZodPipe(billInput.partial())) b: object,
  ) {
    return this.update(u, bills, p.id, b);
  }
  @Delete("bills/:id") @HttpCode(204) deleteBill(@UserId() u: string, @Param(new ZodPipe(idParam)) p: Id) {
    return this.remove(u, bills, p.id);
  }

  @Post("incomes") createIncome(@UserId() u: string, @Body(new ZodPipe(incomeInput)) b: z.output<typeof incomeInput>) {
    return this.create(u, incomes, { ...b, kind: "other" });
  }
  @Patch("incomes/:id") updateIncome(
    @UserId() u: string,
    @Param(new ZodPipe(idParam)) p: Id,
    @Body(new ZodPipe(incomeInput.partial())) b: object,
  ) {
    return this.update(u, incomes, p.id, b);
  }
  @Delete("incomes/:id") @HttpCode(204) deleteIncome(@UserId() u: string, @Param(new ZodPipe(idParam)) p: Id) {
    return this.remove(u, incomes, p.id);
  }

  @Post("sinking-funds") createFund(
    @UserId() u: string,
    @Body(new ZodPipe(sinkingFundInput)) b: z.output<typeof sinkingFundInput>,
  ) {
    return this.create(u, sinkingFunds, b);
  }
  @Patch("sinking-funds/:id") updateFund(
    @UserId() u: string,
    @Param(new ZodPipe(idParam)) p: Id,
    @Body(new ZodPipe(sinkingFundInput.partial())) b: object,
  ) {
    return this.update(u, sinkingFunds, p.id, b);
  }
  @Delete("sinking-funds/:id") @HttpCode(204) deleteFund(@UserId() u: string, @Param(new ZodPipe(idParam)) p: Id) {
    return this.remove(u, sinkingFunds, p.id);
  }

  @Post("debts") createDebt(@UserId() u: string, @Body(new ZodPipe(debtInput)) b: z.output<typeof debtInput>) {
    return this.create(u, debts, debtRow(b));
  }
  // A debt edit re-sends the whole debt so the plan fields stay consistent.
  @Patch("debts/:id") updateDebt(
    @UserId() u: string,
    @Param(new ZodPipe(idParam)) p: Id,
    @Body(new ZodPipe(debtInput)) b: z.output<typeof debtInput>,
  ) {
    return this.update(u, debts, p.id, debtRow(b));
  }
  @Delete("debts/:id") @HttpCode(204) deleteDebt(@UserId() u: string, @Param(new ZodPipe(idParam)) p: Id) {
    return this.remove(u, debts, p.id);
  }

  @Post("debts/:id/payments")
  @HttpCode(201)
  payDebt(
    @UserId() userId: string,
    @Param(new ZodPipe(idParam)) { id }: Id,
    @Body(new ZodPipe(debtPaymentInput)) body: z.output<typeof debtPaymentInput>,
  ) {
    return this.scope.run(userId, async ({ tx, budgetId }) => {
      const [debt] = await tx
        .select({ id: debts.id })
        .from(debts)
        .where(and(eq(debts.id, id), eq(debts.budgetId, budgetId)));
      if (!debt) throw new NotFoundException({ error: "not_found" });
      const cycle = await openCycleOf(tx, budgetId);
      if (!cycle) throw new NotFoundException({ error: "no_open_cycle" });
      const paidOn = body.paidOn ?? todayFor((await userPrefs(tx, userId)).timezone);
      const [payment] = await tx
        .insert(debtPayments)
        .values({ budgetId, debtId: id, cycleId: cycle.id, amount: body.amount, paidOn })
        .returning();
      return { payment };
    });
  }

  @Post("commitments") createCommitment(
    @UserId() u: string,
    @Body(new ZodPipe(commitmentInput)) b: z.output<typeof commitmentInput>,
  ) {
    return this.create(u, commitments, commitmentRow(b));
  }
  @Patch("commitments/:id") updateCommitment(
    @UserId() u: string,
    @Param(new ZodPipe(idParam)) p: Id,
    @Body(new ZodPipe(commitmentInput)) b: z.output<typeof commitmentInput>,
  ) {
    return this.update(u, commitments, p.id, commitmentRow(b));
  }
  @Delete("commitments/:id") @HttpCode(204) deleteCommitment(@UserId() u: string, @Param(new ZodPipe(idParam)) p: Id) {
    return this.remove(u, commitments, p.id);
  }
}
