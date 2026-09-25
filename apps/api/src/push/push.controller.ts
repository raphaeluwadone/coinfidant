import { pushSubscriptionInput, pushUnsubscribeInput } from "@coinfidant/contracts";
import { Body, Controller, Get, HttpCode, Inject, Post, ServiceUnavailableException } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import { UserId } from "../auth/auth.guard";
import { ZodPipe } from "../common/zod.pipe";
import { ScopedDb } from "../db/db.module";
import { pushSubscriptions } from "../db/schema";
import { CheckinService } from "./checkin.service";
import { PUSH_SENDER, type PushSender } from "./sender";

@Controller("push")
export class PushController {
  constructor(
    @Inject(ScopedDb) private readonly scoped: ScopedDb,
    @Inject(PUSH_SENDER) private readonly sender: PushSender,
    @Inject(CheckinService) private readonly checkins: CheckinService,
  ) {}

  @Get("key")
  key() {
    return { available: this.sender.available, publicKey: this.sender.publicKey };
  }

  @Post("subscriptions")
  @HttpCode(204)
  async subscribe(
    @UserId() userId: string,
    @Body(new ZodPipe(pushSubscriptionInput)) body: z.output<typeof pushSubscriptionInput>,
  ) {
    if (!this.sender.available) throw new ServiceUnavailableException({ error: "push_unavailable" });
    const values = { userId, endpoint: body.endpoint, p256dh: body.keys.p256dh, auth: body.keys.auth };
    await this.scoped.run(userId, (tx) =>
      tx
        .insert(pushSubscriptions)
        .values(values)
        .onConflictDoUpdate({
          target: [pushSubscriptions.userId, pushSubscriptions.endpoint],
          set: { p256dh: values.p256dh, auth: values.auth },
        }),
    );
  }

  @Post("unsubscribe")
  @HttpCode(204)
  async unsubscribe(
    @UserId() userId: string,
    @Body(new ZodPipe(pushUnsubscribeInput)) { endpoint }: z.output<typeof pushUnsubscribeInput>,
  ) {
    await this.scoped.run(userId, (tx) =>
      tx
        .delete(pushSubscriptions)
        .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint))),
    );
  }

  /** A sample notification so people can see check-ins work before the evening. */
  @Post("test")
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  async test(@UserId() userId: string) {
    if (!this.sender.available) throw new ServiceUnavailableException({ error: "push_unavailable" });
    const subs = await this.scoped.run(userId, (tx) =>
      tx.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)),
    );
    const sent = await this.checkins.deliver(userId, subs, {
      title: "Coinfidant",
      body: "Test ping 🔔 Your evening check-in will look like this.",
      url: "/",
      tag: "test",
    });
    return { sent };
  }
}
