import { onboardingInput } from "@coinfidant/contracts";
import { addDays, localDate } from "@coinfidant/engine";
import { BadRequestException, Body, ConflictException, Controller, Inject, Post } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import { UserId } from "../auth/auth.guard";
import { ZodPipe } from "../common/zod.pipe";
import { ScopedDb } from "../db/db.module";
import { commitments, cycles, debts, goals, sinkingFunds, users } from "../db/schema";
import { findBudgetId } from "./budget.scope";
import { createBudget } from "./create";
import { todayView } from "./cycles";
import { commitmentRow, debtRow } from "./rows";

// Anything older can't be the cycle you're in now.
const MAX_CYCLE_AGE_DAYS = 45;

@Controller("onboarding")
export class OnboardingController {
  constructor(@Inject(ScopedDb) private readonly scoped: ScopedDb) {}

  /** Saves everything the 10 steps collected in one transaction, so a half-finished onboarding leaves nothing behind. */
  @Post()
  complete(@UserId() userId: string, @Body(new ZodPipe(onboardingInput)) b: z.output<typeof onboardingInput>) {
    return this.scoped.run(userId, async (tx) => {
      if (await findBudgetId(tx, userId)) throw new ConflictException({ error: "already_onboarded" });
      const today = localDate(new Date(), b.timezone);
      if (b.lastSalaryOn > today) throw new BadRequestException({ error: "future_date" });
      if (b.lastSalaryOn < addDays(today, -MAX_CYCLE_AGE_DAYS))
        throw new BadRequestException({ error: "salary_too_old" });

      await tx
        .update(users)
        .set({
          personality: b.personality,
          timezone: b.timezone,
          checkinMethod: b.checkinMethod,
          leakCategories: b.leakCategories,
          overspendTimes: b.overspendTimes,
        })
        .where(eq(users.id, userId));

      const budgetId = await createBudget(tx, userId, b, {
        everydayEstimate: b.discovery ? null : b.everydayEstimate,
        discovery: b.discovery,
        leftoverDefault: b.leftoverDefault,
        paydayMode: b.overspendTimes.includes("afterPayday"),
      });
      const own = <T extends object>(rows: T[]) => rows.map((r) => ({ ...r, budgetId }));
      if (b.sinkingFunds.length) await tx.insert(sinkingFunds).values(own(b.sinkingFunds));
      if (b.debts.length) await tx.insert(debts).values(own(b.debts.map(debtRow)));
      if (b.goals.length) await tx.insert(goals).values(own(b.goals));
      if (b.commitments.length) await tx.insert(commitments).values(own(b.commitments.map(commitmentRow)));
      await tx
        .insert(cycles)
        .values({ budgetId, startDate: b.lastSalaryOn, salary: b.salary, status: "open", paydaySeenAt: new Date() });

      return todayView({ tx, userId, budgetId });
    });
  }
}
