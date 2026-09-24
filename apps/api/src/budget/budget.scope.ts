import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { ScopedDb, type Tx } from "../db/db.module";
import { budgetMembers } from "../db/schema";

export type BudgetCtx = { tx: Tx; userId: string; budgetId: string };

/** Runs `fn` inside the user's RLS transaction with their budget resolved; 404s when they have none yet. */
@Injectable()
export class BudgetScope {
  constructor(@Inject(ScopedDb) private readonly scoped: ScopedDb) {}

  run<T>(userId: string, fn: (ctx: BudgetCtx) => Promise<T>): Promise<T> {
    return this.scoped.run(userId, async (tx) => {
      const budgetId = await findBudgetId(tx, userId);
      if (!budgetId) throw new NotFoundException({ error: "no_budget" });
      return fn({ tx, userId, budgetId });
    });
  }
}

export async function findBudgetId(tx: Tx, userId: string) {
  const [row] = await tx
    .select({ budgetId: budgetMembers.budgetId })
    .from(budgetMembers)
    .where(eq(budgetMembers.userId, userId))
    .limit(1);
  return row?.budgetId ?? null;
}
