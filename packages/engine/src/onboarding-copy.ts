import { formatMoney } from "./money";
import { say, type Tone, TONES } from "./voice";

type Lines = Record<Tone, string>;

const byTone = (f: (t: Tone) => string): Lines => Object.fromEntries(TONES.map(({ key }) => [key, f(key)])) as Lines;

/** The sweep line from the plan doc, used to preview each sass level. */
export const sweepPreview = (amount: number): Lines =>
  byTone((t) => say("sweep.savings", t, { amount: formatMoney(amount) }));

export const paydayLine: Lines = byTone((t) => say("onboarding.payday", t));

export function billsLine(percent: number, tone: Tone): string {
  if (percent === 0) return say("onboarding.bills.none", tone);
  const vars = { percent: `${Math.round(percent)}%` };
  if (percent < 25) return say("onboarding.bills.low", tone, vars);
  if (percent < 50) return say("onboarding.bills.mid", tone, vars);
  return say("onboarding.bills.heavy", tone, vars);
}

export const sinkingLine = (count: number): Lines =>
  byTone((t) => say(count ? "onboarding.sinking.some" : "onboarding.sinking.none", t));

export function debtsLine(count: number): string {
  if (count === 0) return say("onboarding.debts.none", "gentle");
  return say(count >= 5 ? "onboarding.debts.many" : "onboarding.debts.some", "gentle");
}

export const goalsLine = (count: number): Lines =>
  byTone((t) => say(count ? "onboarding.goals.some" : "onboarding.goals.none", t));

export const everydayLine = (discovery: boolean): Lines =>
  byTone((t) => say(discovery ? "onboarding.everyday.discovery" : "onboarding.everyday.estimate", t));

export const paydayModeSample = say("payday.sample", "cheeky");

export const REVEAL_TAGLINE = "It's not a mess. It's a plan now 😏";
