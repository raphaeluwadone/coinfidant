import { coachRequest, idParam } from "@coinfidant/contracts";
import {
  type CoachPace,
  coachFocus,
  coachPayload,
  type CoachReview,
  type ClosedCycle,
  computeOpenCycle,
  cycleCoachPayload,
  type CurrencyCode,
  formatMoney,
  type Phase,
  type Tone,
  tidyCoachReview,
} from "@coinfidant/engine";
import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Inject,
  NotFoundException,
  Param,
  Post,
  ServiceUnavailableException,
  BadGatewayException,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { and, count, desc, eq, inArray, lt, not } from "drizzle-orm";
import type { z } from "zod";
import { UserId } from "../auth/auth.guard";
import { ZodPipe } from "../common/zod.pipe";
import { CONFIG, type Config } from "../config";
import { adviceReviews, cycles } from "../db/schema";
import { type BudgetCtx, BudgetScope } from "../budget/budget.scope";
import { attackTarget } from "../budget/insights";
import {
  activeCategories,
  adjustableCycleOf,
  cycleTransactions,
  engineInput,
  loadBudget,
  openCycleOf,
  todayFor,
  userPrefs,
} from "../budget/load";
import { COACH_LLM, type CoachLlm, CoachLlmError } from "./llm";

@Controller("coach")
export class CoachController {
  constructor(
    @Inject(BudgetScope) private readonly scope: BudgetScope,
    @Inject(COACH_LLM) private readonly llm: CoachLlm,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  @Get()
  view(@UserId() userId: string) {
    return this.scope.run(userId, (ctx) => this.coachView(ctx));
  }

  /** Returns this week's stored read unless `fresh`, which asks for another and counts against the cycle cap. */
  @Post("reviews")
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  async ask(@UserId() userId: string, @Body(new ZodPipe(coachRequest)) { fresh }: z.output<typeof coachRequest>) {
    // The model call runs between two short transactions so no DB transaction waits on the network.
    const prepared = await this.scope.run(userId, async (ctx) => {
      const state = await this.state(ctx);
      if (!fresh && state.current) return { done: await this.coachView(ctx) };
      if (state.used >= this.config.COACH_CYCLE_CAP) throw capReached();
      return { job: state.job };
    });
    if ("done" in prepared) return prepared.done;
    if (!this.llm.available) throw new ServiceUnavailableException({ error: "coach_unavailable" });

    const { job } = prepared;
    const result = await this.callModel(job.tone, job.payload);

    return this.scope.run(userId, async (ctx) => {
      if ((await this.usedThisCycle(ctx, job.cycleId)) >= this.config.COACH_CYCLE_CAP) throw capReached();
      await ctx.tx.insert(adviceReviews).values({
        budgetId: ctx.budgetId,
        cycleId: job.cycleId,
        weekIndex: job.weekIndex,
        pace: job.payload.pace,
        payload: job.payload,
        review: tidyCoachReview(result.review),
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      });
      return this.coachView(ctx);
    });
  }

  @Get("cycles/:id")
  cycleView(@UserId() userId: string, @Param(new ZodPipe(idParam)) { id }: z.output<typeof idParam>) {
    return this.scope.run(userId, (ctx) => this.cycleCoachView(ctx, id));
  }

  /** The wrap-up read for a closed cycle. Only the latest closed cycle can get new reads, up to CYCLE_CAP. */
  @Post("cycles/:id/reviews")
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  async askCycle(
    @UserId() userId: string,
    @Param(new ZodPipe(idParam)) { id }: z.output<typeof idParam>,
    @Body(new ZodPipe(coachRequest)) { fresh }: z.output<typeof coachRequest>,
  ) {
    const prepared = await this.scope.run(userId, async (ctx) => {
      const state = await this.cycleState(ctx, id);
      if (!fresh && state.current) return { done: await this.cycleCoachView(ctx, id) };
      if (!state.reviewable) throw new ConflictException({ error: "cycle_not_reviewable" });
      if (state.used >= CYCLE_CAP) throw capReached();
      return { job: state.job };
    });
    if ("done" in prepared) return prepared.done;
    if (!this.llm.available) throw new ServiceUnavailableException({ error: "coach_unavailable" });

    const { job } = prepared;
    const result = await this.callModel(job.tone, job.payload);
    return this.scope.run(userId, async (ctx) => {
      if ((await this.cycleState(ctx, id)).used >= CYCLE_CAP) throw capReached();
      await ctx.tx.insert(adviceReviews).values({
        budgetId: ctx.budgetId,
        cycleId: id,
        kind: "cycle",
        weekIndex: null,
        pace: job.payload.pace,
        payload: job.payload,
        review: tidyCoachReview(result.review),
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      });
      return this.cycleCoachView(ctx, id);
    });
  }

  private async callModel(...args: Parameters<CoachLlm["review"]>) {
    try {
      return await this.llm.review(...args);
    } catch (e) {
      if (e instanceof CoachLlmError) throw new BadGatewayException({ error: "coach_failed" });
      throw e;
    }
  }

  private async cycleState(ctx: BudgetCtx, cycleId: string) {
    const { tx, userId, budgetId } = ctx;
    const [row] = await tx
      .select()
      .from(cycles)
      .where(and(eq(cycles.id, cycleId), eq(cycles.budgetId, budgetId), inArray(cycles.status, ["closed", "locked"])));
    if (!row) throw new NotFoundException({ error: "not_found" });
    const [budget, prefs, latest] = await Promise.all([
      loadBudget(tx, budgetId),
      userPrefs(tx, userId),
      adjustableCycleOf(tx, budgetId),
    ]);
    const reviews = await tx
      .select()
      .from(adviceReviews)
      .where(
        and(eq(adviceReviews.budgetId, budgetId), eq(adviceReviews.cycleId, cycleId), eq(adviceReviews.kind, "cycle")),
      )
      .orderBy(desc(adviceReviews.createdAt));
    // The wrap-up to follow up on is the one for the cycle before this.
    const [prev] = await tx
      .select({ pace: adviceReviews.pace, review: adviceReviews.review })
      .from(adviceReviews)
      .innerJoin(cycles, eq(cycles.id, adviceReviews.cycleId))
      .where(
        and(eq(adviceReviews.budgetId, budgetId), eq(adviceReviews.kind, "cycle"), lt(cycles.startDate, row.startDate)),
      )
      .orderBy(desc(cycles.startDate), desc(adviceReviews.createdAt))
      .limit(1);

    const closed = row.snapshot as ClosedCycle;
    const txns = await cycleTransactions(tx, budgetId, row.startDate, closed.cycle.end);
    const tone = prefs.personality as Tone;
    const payload = cycleCoachPayload({
      closed,
      txns: txns.map((t) => ({ ...t, date: t.localDate, type: t.type as "spend" | "refund" })),
      categories: budget!.categories,
      tone,
      phase: budget!.discovery ? null : (budget!.phase as Phase | null),
      discovery: budget!.discovery,
      pending: closed.debts
        .filter((d) => d.unpaid > 0)
        .map((d) => ({ name: budget!.debts.find((x) => x.id === d.id)?.name ?? "A debt", unpaid: d.unpaid })),
      previous: prev ? { pace: prev.pace as CoachPace, review: prev.review as CoachReview } : null,
      money: (n) => formatMoney(n, budget!.currency as CurrencyCode),
    });
    return {
      current: reviews[0] ?? null,
      used: reviews.length,
      reviewable: latest?.id === cycleId && row.status === "closed",
      job: { tone, payload },
    };
  }

  private async cycleCoachView(ctx: BudgetCtx, cycleId: string) {
    const state = await this.cycleState(ctx, cycleId);
    const c = state.current;
    return {
      available: this.llm.available,
      cap: CYCLE_CAP,
      used: state.used,
      remaining: state.reviewable ? Math.max(0, CYCLE_CAP - state.used) : 0,
      reviewable: state.reviewable,
      current: c ? { id: c.id, pace: c.pace, review: c.review, createdAt: c.createdAt } : null,
    };
  }

  private async state(ctx: BudgetCtx) {
    const { tx, userId, budgetId } = ctx;
    const [budget, prefs, cycle] = await Promise.all([
      loadBudget(tx, budgetId),
      userPrefs(tx, userId),
      openCycleOf(tx, budgetId),
    ]);
    if (!budget || !cycle) throw new ConflictException({ error: "no_open_cycle" });
    const today = todayFor(prefs.timezone);
    const { input, txns } = await engineInput(tx, budget, cycle, today);
    const open = computeOpenCycle(input);
    const weekIndex = coachFocus(open).week.index;

    const reviews = await tx
      .select({ id: adviceReviews.id, cycleId: adviceReviews.cycleId, weekIndex: adviceReviews.weekIndex })
      .from(adviceReviews)
      .where(
        and(eq(adviceReviews.budgetId, budgetId), eq(adviceReviews.cycleId, cycle.id), eq(adviceReviews.kind, "week")),
      )
      .orderBy(desc(adviceReviews.createdAt));
    const current = reviews.find((r) => r.weekIndex === weekIndex) ?? null;

    // The read to follow up on is the latest one about a different week, so "another read" still looks back.
    const [prev] = await tx
      .select()
      .from(adviceReviews)
      .where(
        and(
          eq(adviceReviews.budgetId, budgetId),
          eq(adviceReviews.kind, "week"),
          not(and(eq(adviceReviews.cycleId, cycle.id), eq(adviceReviews.weekIndex, weekIndex))!),
        ),
      )
      .orderBy(desc(adviceReviews.createdAt))
      .limit(1);

    const tone = prefs.personality as Tone;
    const target = attackTarget(budget, input);
    const payload = coachPayload({
      open,
      txns: txns.map((t) => ({ ...t, date: t.localDate, type: t.type as "spend" | "refund" })),
      categories: activeCategories(budget),
      tone,
      phase: budget.discovery ? null : (budget.phase as Phase | null),
      discovery: budget.discovery,
      target: target ? { name: target.name, amountLeft: target.amountLeft } : null,
      previous: prev
        ? {
            weekIndex: prev.weekIndex!,
            sameCycle: prev.cycleId === cycle.id,
            pace: prev.pace as CoachPace,
            review: prev.review as CoachReview,
          }
        : null,
      money: (n) => formatMoney(n, budget.currency as CurrencyCode),
    });

    return {
      current,
      used: reviews.length,
      focus: { weekIndex, inProgress: coachFocus(open).inProgress },
      job: { tone, payload, cycleId: cycle.id, weekIndex },
    };
  }

  private async usedThisCycle({ tx, budgetId }: BudgetCtx, cycleId: string) {
    const [row] = await tx
      .select({ n: count() })
      .from(adviceReviews)
      .where(
        and(eq(adviceReviews.budgetId, budgetId), eq(adviceReviews.cycleId, cycleId), eq(adviceReviews.kind, "week")),
      );
    return row?.n ?? 0;
  }

  private async coachView(ctx: BudgetCtx) {
    const cycle = await openCycleOf(ctx.tx, ctx.budgetId);
    const base = { available: this.llm.available, cap: this.config.COACH_CYCLE_CAP };
    const history = await ctx.tx
      .select({
        id: adviceReviews.id,
        cycleId: adviceReviews.cycleId,
        cycleStart: cycles.startDate,
        kind: adviceReviews.kind,
        weekIndex: adviceReviews.weekIndex,
        pace: adviceReviews.pace,
        review: adviceReviews.review,
        createdAt: adviceReviews.createdAt,
      })
      .from(adviceReviews)
      .innerJoin(cycles, eq(cycles.id, adviceReviews.cycleId))
      .where(eq(adviceReviews.budgetId, ctx.budgetId))
      .orderBy(desc(adviceReviews.createdAt))
      .limit(8);
    if (!cycle) return { ...base, used: 0, remaining: 0, focus: null, current: null, history };

    const state = await this.state(ctx);
    const current = state.current ? (history.find((h) => h.id === state.current!.id) ?? null) : null;
    return {
      ...base,
      used: state.used,
      remaining: Math.max(0, this.config.COACH_CYCLE_CAP - state.used),
      focus: state.focus,
      current,
      history: history.filter((h) => h.id !== current?.id),
    };
  }
}

/** Wrap-up reads per closed cycle: one, plus one "another read". */
const CYCLE_CAP = 2;

const capReached = () => new HttpException({ error: "coach_cap" }, 429);
