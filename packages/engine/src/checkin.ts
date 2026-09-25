import { paceStatus } from "./copy";
import type { Minor } from "./money";
import type { OpenCycle } from "./types";
import { say, type Tone } from "./voice";

export type CheckinMethod = "evening" | "drift" | "app";
export type CheckinMessage = { title: string; body: string; url: string; tag: string };

/** R29: tomorrow's daily allowance: the rest of this week spread over its remaining days, or next week's pace. */
export function tomorrowAllowance(open: OpenCycle): Minor {
  const t = open.today;
  if (t.daysLeftInWeek > 1) return Math.floor(Math.max(0, t.leftThisWeek) / (t.daysLeftInWeek - 1));
  const next = open.weeks[t.week.index + 1];
  return next ? Math.floor(next.budget / next.days) : 0;
}

/**
 * R29: the evening push. "evening" always nudges with tomorrow's number; "drift" only speaks up when the
 * week is off pace; "app" never pushes.
 */
export function checkinMessage(
  open: OpenCycle,
  method: CheckinMethod,
  tone: Tone,
  money: (n: Minor) => string,
  opts: { stakes?: boolean; seed?: number } = {},
): CheckinMessage | null {
  if (method === "app") return null;
  const over = -open.today.leftThisWeek;
  if (method === "drift") {
    if (paceStatus(open) === "onTrack") return null;
    if (over > 0)
      return {
        title: "Coinfidant",
        body: say("checkin.drift", tone, { amount: money(over) }, opts),
        url: "/",
        tag: "checkin",
      };
  }
  return {
    title: "Coinfidant",
    body: say("checkin.evening", tone, { amount: money(tomorrowAllowance(open)) }, opts),
    url: "/log",
    tag: "checkin",
  };
}
