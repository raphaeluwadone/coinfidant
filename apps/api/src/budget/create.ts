import { CATEGORIES } from "@coinfidant/engine";
import type { Tx } from "../db/db.module";
import { bills, budgetMembers, budgets, categories, incomes } from "../db/schema";

type Basics = {
  currency: string;
  savingsPercent: number;
  expectedPayday: number;
  salary: number;
  bills: { name: string; amount: number }[];
};

type Extras = Partial<
  Pick<typeof budgets.$inferInsert, "everydayEstimate" | "leftoverDefault" | "paydayMode" | "discovery">
>;

/** A new budget with its owner, salary income, the default categories and bills. */
export async function createBudget(tx: Tx, userId: string, b: Basics, extras: Extras = {}) {
  const [budget] = await tx
    .insert(budgets)
    .values({
      ownerId: userId,
      currency: b.currency,
      savingsPercent: b.savingsPercent,
      expectedPayday: b.expectedPayday,
      ...extras,
    })
    .returning({ id: budgets.id });
  const budgetId = budget!.id;
  await tx.insert(budgetMembers).values({ budgetId, userId, role: "owner" });
  await tx.insert(incomes).values({ budgetId, name: "Salary", amount: b.salary, kind: "salary" });
  await tx
    .insert(categories)
    .values(CATEGORIES.map((c, position) => ({ budgetId, name: c.label, emoji: c.emoji, slug: c.key, position })));
  if (b.bills.length) await tx.insert(bills).values(b.bills.map((x) => ({ ...x, budgetId })));
  return budgetId;
}
