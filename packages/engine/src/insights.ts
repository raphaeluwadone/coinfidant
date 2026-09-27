import { addDays, daysBetween, type ISODate, weekday } from "./date";
import type { DiscoveryTxn } from "./discovery";
import type { Minor } from "./money";
import type { OpenCycle } from "./types";
import { say, type Tone, type VoiceKey } from "./voice";

export type InsightKey =
  | "ahead"
  | "behind"
  | "swept"
  | "spread"
  | "borrowed"
  | "category"
  | "weekday"
  | "streak"
  | "gap"
  | "payday"
  | "target";

export type Insight = {
  key: InsightKey;
  severity: "good" | "info" | "warn";
  emoji: string;
  vars: {
    amount?: Minor;
    name?: string;
    emoji?: string;
    percent?: string;
    day?: string;
    count?: number;
    days?: number;
  };
};

export type InsightInput = {
  open: OpenCycle;
  /** This cycle's transactions. */
  txns: DiscoveryTxn[];
  categories: { id: string; name: string; emoji: string }[];
  streak: number;
  /** Most recent logged date ever, or null if nothing has been logged. */
  lastLogged: ISODate | null;
  discovery: boolean;
  target: { name: string; amountLeft: Minor } | null;
  /** Insight keys shown recently; skipped while enough others exist. */
  recent?: InsightKey[];
};

const WEIGHT = { warn: 3, good: 2, info: 1 } as const;

/** Each insight's icon. The card shows it beside the line, so the lines themselves never repeat it. */
export const INSIGHT_EMOJI = {
  ahead: "😎",
  behind: "🛑",
  swept: "🧹",
  borrowed: "🫣",
  spread: "🌶️",
  weekday: "📅",
  streak: "🔥",
  gap: "🦗",
  payday: "💸",
  target: "⚔️",
} as const satisfies Partial<Record<InsightKey, string>>;
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MAX = 3;

type Candidate = Insight & { weight: number };

/** R27: the rules layer. Picks the 2–3 most relevant things worth saying today. */
export function generateInsights(i: InsightInput): Insight[] {
  const { open } = i;
  const today = open.today.date;
  const week = open.today.week;
  const spends = i.txns.filter((t) => t.type === "spend");
  const net = (t: DiscoveryTxn) => (t.type === "refund" ? -t.amount : t.amount);
  const c: Candidate[] = [];
  const add = (x: Insight, bonus = 0) => c.push({ ...x, weight: WEIGHT[x.severity] + bonus });

  // Pace against this week's plan, once the week has a couple of days behind it.
  const elapsed = daysBetween(week.start, today);
  if (elapsed >= 2 && !i.discovery && week.budget > 0) {
    const expected = Math.round((week.budget * elapsed) / week.days);
    const spent = i.txns.filter((t) => t.date >= week.start && t.date < today).reduce((a, t) => a + net(t), 0);
    const diff = expected - spent;
    if (Math.abs(diff) >= week.budget * 0.05) {
      if (diff > 0) add({ key: "ahead", severity: "good", emoji: INSIGHT_EMOJI.ahead, vars: { amount: diff } });
      else add({ key: "behind", severity: "warn", emoji: INSIGHT_EMOJI.behind, vars: { amount: -diff } });
    }
  }

  // How last week ended.
  const prev = open.weeks[week.index - 1];
  if (prev?.outcome?.kind === "swept" && prev.outcome.amount > 0 && prev.spent > 0) {
    add({ key: "swept", severity: "good", emoji: INSIGHT_EMOJI.swept, vars: { amount: prev.outcome.amount } });
  } else if (prev?.outcome?.kind === "over") {
    if (prev.outcome.floorHit)
      add(
        { key: "borrowed", severity: "warn", emoji: INSIGHT_EMOJI.borrowed, vars: { amount: prev.outcome.borrowed } },
        0.5,
      );
    else
      add({ key: "spread", severity: "info", emoji: INSIGHT_EMOJI.spread, vars: { amount: prev.outcome.spread } }, 0.5);
  }

  // One category dominating this week.
  const weekSpends = spends.filter((t) => t.date >= week.start && t.date <= today);
  const weekTotal = weekSpends.reduce((a, t) => a + t.amount, 0);
  if (weekSpends.length >= 3 && weekTotal > 0) {
    const byCat = new Map<string, number>();
    for (const t of weekSpends) byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) + t.amount);
    const [topId, topAmount] = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0]!;
    const share = topAmount / weekTotal;
    const cat = i.categories.find((x) => x.id === topId);
    if (share >= 0.4 && cat) {
      add(
        {
          key: "category",
          severity: "info",
          emoji: cat.emoji,
          vars: { emoji: cat.emoji, name: cat.name, percent: `${Math.round(share * 100)}%` },
        },
        0.5,
      );
    }
  }

  // A weekday that runs hot, once there's enough of the cycle to tell.
  if (open.cycle.dayIndex >= 10) {
    const totals = Array(7).fill(0) as number[];
    const counts = Array(7).fill(0) as number[];
    for (let d = open.cycle.start; d < today; d = addDays(d, 1)) counts[weekday(d)]!++;
    for (const t of spends) if (t.date < today) totals[weekday(t.date)]! += t.amount;
    const avg = totals.map((t, k) => (counts[k] ? t / counts[k]! : 0));
    const top = avg.indexOf(Math.max(...avg));
    const others = avg.filter((_, k) => k !== top && counts[k]);
    const rest = others.length ? others.reduce((a, b) => a + b, 0) / others.length : 0;
    if (avg[top]! > 0 && avg[top]! >= 2 * rest)
      add({ key: "weekday", severity: "info", emoji: INSIGHT_EMOJI.weekday, vars: { day: DAY_NAMES[top]! } });
  }

  if (i.streak >= 3 && !i.discovery)
    add({ key: "streak", severity: "good", emoji: INSIGHT_EMOJI.streak, vars: { count: i.streak } }, -0.5);

  const quietFor = i.lastLogged ? daysBetween(i.lastLogged, today) : open.cycle.dayIndex;
  if (quietFor >= 2) add({ key: "gap", severity: "info", emoji: INSIGHT_EMOJI.gap, vars: { days: quietFor } }, 1);

  const toPayday = daysBetween(today, open.cycle.projectedEnd) + 1;
  if (toPayday >= 1 && toPayday <= 3 && open.cycle.overrunDays === 0) {
    add({ key: "payday", severity: "info", emoji: INSIGHT_EMOJI.payday, vars: { days: toPayday } });
  }

  if (i.target)
    add(
      {
        key: "target",
        severity: "info",
        emoji: INSIGHT_EMOJI.target,
        vars: { name: i.target.name, amount: i.target.amountLeft },
      },
      -0.5,
    );

  const ranked = c.sort((a, b) => b.weight - a.weight);
  const fresh = ranked.filter((x) => !i.recent?.includes(x.key));
  const picked = fresh.length >= 2 ? fresh : [...fresh, ...ranked.filter((x) => i.recent?.includes(x.key))];
  return picked.slice(0, MAX).map(({ weight: _, ...x }) => x);
}

/** Words for an insight, in a tone. Money is formatted by the caller's currency. */
export function insightText(x: Insight, tone: Tone, money: (n: Minor) => string, opts: { stakes?: boolean } = {}) {
  const { amount, ...rest } = x.vars;
  return say(
    `insight.${x.key}` as VoiceKey,
    tone,
    { ...rest, ...(amount !== undefined ? { amount: money(amount) } : {}) },
    opts,
  );
}
