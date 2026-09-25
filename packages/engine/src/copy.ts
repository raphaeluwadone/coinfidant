import type { OpenCycle, WeekOutcome } from "./types";
import { linesFor, say, type Tone, type VoiceKey } from "./voice";

export { TONES, type Tone } from "./voice";

export type TodayMood = "fresh" | "onTrack" | "tight" | "spentOut" | "overWeek" | "overcommitted";

export function todayMood(s: OpenCycle): TodayMood {
  if (s.events.some((e) => e.type === "overcommitted")) return "overcommitted";
  if (s.today.leftThisWeek < 0) return "overWeek";
  if (s.today.spendToday <= 0 && s.today.spentToday > 0) return "spentOut";
  if (s.today.spentToday === 0) return "fresh";
  return s.today.spendToday < s.today.dailyPace * 0.25 ? "tight" : "onTrack";
}

export function quipsFor(mood: TodayMood, tone: Tone, opts: { stakes?: boolean } = {}): string[] {
  return linesFor(`today.${mood}`, tone, opts);
}

const LOG_KEYS = new Set(["food", "groceries", "transport", "shopping", "fun", "health", "home", "other"]);

export function reactionFor(category: string, tone: Tone, overToday: boolean, opts: { stakes?: boolean } = {}): string {
  const key = (overToday ? "log.overToday" : `log.${LOG_KEYS.has(category) ? category : "other"}`) as VoiceKey;
  return say(key, tone, {}, opts);
}

export type PaceStatus = "onTrack" | "slowDown" | "over";

export function paceStatus(s: OpenCycle): PaceStatus {
  if (s.today.leftThisWeek < 0) return "over";
  return s.today.spendToday < 0 ? "slowDown" : "onTrack";
}

export const PACE_LABEL: Record<PaceStatus, string> = { onTrack: "On track", slowDown: "Slow down", over: "Over" };

/** History's one-liner for a finished week. Borrowing from savings gets the calm voice at every level. */
export function weekLine(outcome: WeekOutcome | undefined, tone: Tone, formatted: (n: number) => string): string {
  if (!outcome) return "";
  if (outcome.kind === "swept") return say("week.swept", tone);
  if (outcome.floorHit) return say("week.floorHit", tone, { amount: formatted(outcome.borrowed) });
  return say("week.spread", tone);
}
