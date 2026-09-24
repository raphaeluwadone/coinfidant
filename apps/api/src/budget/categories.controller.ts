import { categoryInput, categoryPatch, idParam, MAX_ACTIVE_CATEGORIES } from "@coinfidant/contracts";
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { and, count, eq, isNull } from "drizzle-orm";
import type { z } from "zod";
import { UserId } from "../auth/auth.guard";
import { ZodPipe } from "../common/zod.pipe";
import type { Tx } from "../db/db.module";
import { categories } from "../db/schema";
import { BudgetScope } from "./budget.scope";

type Id = z.output<typeof idParam>;

const activeCount = (tx: Tx, budgetId: string) =>
  tx
    .select({ n: count() })
    .from(categories)
    .where(and(eq(categories.budgetId, budgetId), isNull(categories.archivedAt)))
    .then((r) => r[0]!.n);

/** Categories are archived, never deleted, so old transactions keep their label. */
@Controller("categories")
export class CategoriesController {
  constructor(@Inject(BudgetScope) private readonly scope: BudgetScope) {}

  @Post()
  create(@UserId() userId: string, @Body(new ZodPipe(categoryInput)) body: z.output<typeof categoryInput>) {
    return this.scope.run(userId, async ({ tx, budgetId }) => {
      const n = await activeCount(tx, budgetId);
      if (n >= MAX_ACTIVE_CATEGORIES) throw new ConflictException({ error: "category_limit" });
      const [category] = await tx
        .insert(categories)
        .values({ ...body, budgetId, position: n })
        .returning();
      return { category };
    });
  }

  @Patch(":id")
  update(
    @UserId() userId: string,
    @Param(new ZodPipe(idParam)) { id }: Id,
    @Body(new ZodPipe(categoryPatch)) body: z.output<typeof categoryPatch>,
  ) {
    if (!Object.keys(body).length) throw new BadRequestException({ error: "empty_update" });
    return this.scope.run(userId, async ({ tx, budgetId }) => {
      const [category] = await tx
        .update(categories)
        .set(body)
        .where(and(eq(categories.id, id), eq(categories.budgetId, budgetId)))
        .returning();
      if (!category) throw new NotFoundException({ error: "not_found" });
      return { category };
    });
  }

  @Post(":id/archive")
  archive(@UserId() userId: string, @Param(new ZodPipe(idParam)) { id }: Id) {
    return this.scope.run(userId, async ({ tx, budgetId }) => {
      if ((await activeCount(tx, budgetId)) <= 1) throw new ConflictException({ error: "last_category" });
      const [category] = await tx
        .update(categories)
        .set({ archivedAt: new Date() })
        .where(and(eq(categories.id, id), eq(categories.budgetId, budgetId), isNull(categories.archivedAt)))
        .returning();
      if (!category) throw new NotFoundException({ error: "not_found" });
      return { category };
    });
  }

  @Post(":id/restore")
  restore(@UserId() userId: string, @Param(new ZodPipe(idParam)) { id }: Id) {
    return this.scope.run(userId, async ({ tx, budgetId }) => {
      if ((await activeCount(tx, budgetId)) >= MAX_ACTIVE_CATEGORIES) {
        throw new ConflictException({ error: "category_limit" });
      }
      const [category] = await tx
        .update(categories)
        .set({ archivedAt: null })
        .where(and(eq(categories.id, id), eq(categories.budgetId, budgetId)))
        .returning();
      if (!category) throw new NotFoundException({ error: "not_found" });
      return { category };
    });
  }
}
