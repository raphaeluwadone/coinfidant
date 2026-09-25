import { Inject, Injectable } from "@nestjs/common";
import webpush from "web-push";
import { CONFIG, type Config } from "../config";

export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushPayload = { title: string; body: string; url: string; tag: string };

/** "gone" means the browser dropped the subscription and it should be deleted. */
export interface PushSender {
  readonly available: boolean;
  readonly publicKey: string | null;
  send(to: PushTarget, payload: PushPayload): Promise<"ok" | "gone">;
}

export const PUSH_SENDER = Symbol("PUSH_SENDER");

@Injectable()
export class WebPushSender implements PushSender {
  constructor(@Inject(CONFIG) private readonly config: Config) {}

  get available() {
    return !!(this.config.VAPID_PUBLIC_KEY && this.config.VAPID_PRIVATE_KEY && this.config.VAPID_SUBJECT);
  }

  get publicKey() {
    return this.available ? this.config.VAPID_PUBLIC_KEY! : null;
  }

  async send(to: PushTarget, payload: PushPayload) {
    const c = this.config;
    if (!this.available) return "ok" as const;
    try {
      await webpush.sendNotification(
        { endpoint: to.endpoint, keys: { p256dh: to.p256dh, auth: to.auth } },
        JSON.stringify(payload),
        {
          vapidDetails: { subject: c.VAPID_SUBJECT!, publicKey: c.VAPID_PUBLIC_KEY!, privateKey: c.VAPID_PRIVATE_KEY! },
          TTL: 6 * 60 * 60,
          timeout: 10_000,
        },
      );
      return "ok" as const;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return "gone" as const;
      throw e;
    }
  }
}
