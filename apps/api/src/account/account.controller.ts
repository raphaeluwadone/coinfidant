import { deleteAccountInput } from "@coinfidant/contracts";
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Post,
  Res,
  ServiceUnavailableException,
} from "@nestjs/common";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import { eq, inArray, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { Response } from "express";
import type { z } from "zod";
import { Public, UserId } from "../auth/auth.guard";
import { TokensService } from "../auth/tokens.service";
import { ZodPipe } from "../common/zod.pipe";
import { DB, type Db, ScopedDb, type Tx } from "../db/db.module";
import * as s from "../db/schema";

/** Everything a budget owns, exported as-is. Auth tokens and push keys are left out on purpose. */
const BUDGET_TABLES = {
  incomes: s.incomes,
  bills: s.bills,
  sinkingFunds: s.sinkingFunds,
  debts: s.debts,
  debtPayments: s.debtPayments,
  commitments: s.commitments,
  goals: s.goals,
  categories: s.categories,
  cycles: s.cycles,
  transactions: s.transactions,
  cycleTopUps: s.cycleTopUps,
  sweepChoices: s.sweepChoices,
  coachReviews: s.adviceReviews,
} satisfies Record<string, PgTable & { budgetId: unknown }>;

@Controller()
export class AccountController {
  constructor(
    @Inject(ScopedDb) private readonly scoped: ScopedDb,
    @Inject(DB) private readonly db: Db,
    @Inject(TokensService) private readonly tokens: TokensService,
  ) {}

  @Public()
  @SkipThrottle()
  @Get("health")
  async health() {
    try {
      await this.db.execute(sql`select 1`);
      return { ok: true };
    } catch {
      throw new ServiceUnavailableException({ ok: false });
    }
  }

  @Get("me/export")
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Header("Content-Type", "application/json; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="coinfidant-export.json"')
  @Header("Cache-Control", "no-store")
  export(@UserId() userId: string) {
    return this.scoped.run(userId, async (tx) => {
      const [user] = await tx
        .select({
          email: s.users.email,
          displayName: s.users.displayName,
          timezone: s.users.timezone,
          personality: s.users.personality,
          checkinMethod: s.users.checkinMethod,
          leakCategories: s.users.leakCategories,
          overspendTimes: s.users.overspendTimes,
          createdAt: s.users.createdAt,
        })
        .from(s.users)
        .where(eq(s.users.id, userId));
      const signIns = await tx
        .select({ provider: s.authIdentities.provider, since: s.authIdentities.createdAt })
        .from(s.authIdentities)
        .where(eq(s.authIdentities.userId, userId));
      const ids = await myBudgetIds(tx, userId);
      const budgets = [];
      for (const id of ids) {
        const [budget] = await tx.select().from(s.budgets).where(eq(s.budgets.id, id));
        const rows: Record<string, unknown[]> = {};
        for (const [name, table] of Object.entries(BUDGET_TABLES))
          rows[name] = await tx.select().from(table).where(eq(table.budgetId, id));
        budgets.push({ ...budget, ...rows });
      }
      return { exportedAt: new Date().toISOString(), format: 1, moneyUnit: "minor", user, signIns, budgets };
    });
  }

  /** Deletes the account and its budgets at once; there is no undo. */
  @Post("me/delete")
  @HttpCode(204)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async remove(
    @UserId() userId: string,
    @Body(new ZodPipe(deleteAccountInput)) _body: z.output<typeof deleteAccountInput>,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.scoped.run(userId, async (tx) => {
      // TODO(sharing): once budgets can be shared, keep a budget that still has other members.
      const ids = await myBudgetIds(tx, userId);
      if (ids.length) await tx.delete(s.budgets).where(inArray(s.budgets.id, ids));
      await tx.delete(s.users).where(eq(s.users.id, userId));
    });
    this.tokens.clearCookies(res);
  }
}

const myBudgetIds = (tx: Tx, userId: string) =>
  tx
    .select({ id: s.budgetMembers.budgetId })
    .from(s.budgetMembers)
    .where(eq(s.budgetMembers.userId, userId))
    .then((r) => r.map((x) => x.id));
