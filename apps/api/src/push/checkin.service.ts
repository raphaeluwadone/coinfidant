import {
  checkinMessage,
  type CheckinMethod,
  computeOpenCycle,
  type CurrencyCode,
  formatMoney,
  stakesHigh,
  toDayNum,
  type Tone,
} from "@coinfidant/engine";
import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { and, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { findBudgetId } from "../budget/budget.scope";
import { engineInput, loadBudget, openCycleOf, todayFor } from "../budget/load";
import { CONFIG, type Config } from "../config";
import { DB, type Db, ScopedDb } from "../db/db.module";
import { pushSubscriptions, users } from "../db/schema";
import { PUSH_SENDER, type PushPayload, type PushSender, type PushTarget } from "./sender";

const TICK_MS = 10 * 60_000;

const localHour = (timezone: string, now: Date) =>
  Number(new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "numeric", hourCycle: "h23" }).format(now));

/** Sends the evening check-in once a day per user, in the hour set by CHECKIN_HOUR, in their own timezone. */
@Injectable()
export class CheckinService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger("checkin");
  private timer?: NodeJS.Timeout;

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ScopedDb) private readonly scoped: ScopedDb,
    @Inject(PUSH_SENDER) private readonly sender: PushSender,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  onModuleInit() {
    if (this.config.NODE_ENV === "test" || !this.sender.available) return;
    this.timer = setInterval(() => void this.run().catch((e) => this.log.error(e)), TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  /** One pass over everyone who asked for check-ins. Returns how many notifications went out. */
  async run(now = new Date()) {
    const candidates = await this.db
      .select({ id: users.id, timezone: users.timezone })
      .from(users)
      .where(inArray(users.checkinMethod, ["evening", "drift"]));
    let sent = 0;
    for (const u of candidates) {
      if (localHour(u.timezone, now) !== this.config.CHECKIN_HOUR) continue;
      try {
        sent += await this.checkIn(u.id, now);
      } catch (e) {
        this.log.error(`check-in failed: ${(e as Error).message}`);
      }
    }
    return sent;
  }

  private async checkIn(userId: string, now: Date) {
    const job = await this.scoped.run(userId, async (tx) => {
      const subs = await tx.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
      if (!subs.length) return null;
      const [u] = await tx.select().from(users).where(eq(users.id, userId));
      if (!u) return null;
      const today = todayFor(u.timezone, now);
      // Claiming the day first means two API machines can't both send it.
      const claimed = await tx
        .update(users)
        .set({ lastCheckinOn: today })
        .where(and(eq(users.id, userId), or(isNull(users.lastCheckinOn), ne(users.lastCheckinOn, today))))
        .returning({ id: users.id });
      if (!claimed.length) return null;

      const budgetId = await findBudgetId(tx, userId);
      const [budget, cycle] = budgetId
        ? await Promise.all([loadBudget(tx, budgetId), openCycleOf(tx, budgetId)])
        : [null, null];
      if (!budget || !cycle) return null;
      const { input } = await engineInput(tx, budget, cycle, today);
      const open = computeOpenCycle(input);
      // Discovery is judgement-free, so drift alerts wait until the cycle has taught us real numbers.
      const method = u.checkinMethod as CheckinMethod;
      if (budget.discovery && method === "drift") return null;
      const payload = checkinMessage(
        open,
        method,
        u.personality as Tone,
        (n) => formatMoney(n, budget.currency as CurrencyCode),
        { stakes: stakesHigh(open), seed: toDayNum(today) },
      );
      return payload ? { subs, payload } : null;
    });
    if (!job) return 0;
    return this.deliver(userId, job.subs, job.payload);
  }

  /** Sends to every device and forgets the ones the browser has dropped. */
  async deliver(userId: string, subs: (PushTarget & { id: string })[], payload: PushPayload) {
    let sent = 0;
    const gone: string[] = [];
    for (const s of subs) {
      if ((await this.sender.send(s, payload)) === "gone") gone.push(s.id);
      else sent++;
    }
    if (gone.length)
      await this.scoped.run(userId, (tx) => tx.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone)));
    return sent;
  }
}
