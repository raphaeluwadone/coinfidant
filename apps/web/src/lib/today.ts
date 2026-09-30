import type {
  CurrencyCode,
  DiscoveryProgress,
  Insight,
  InsightKey,
  ISODate,
  Minor,
  OpenCycle,
  Phase,
} from "@coinfidant/engine";
import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";
import { applyPhasePreview } from "./phasePreview";
import type { Category, Prefs } from "./budget";

export type TxnRow = {
  id: string;
  amount: Minor;
  type: "spend" | "refund";
  note: string | null;
  occurredAt: string;
  localDate: ISODate;
  categoryId: string;
  category: { name: string; emoji: string; slug: string | null };
};

export type TodayData = {
  prefs: Prefs;
  currency: CurrencyCode;
  categories: Category[];
  budget: { paydayMode: boolean; discovery: boolean; everydayEstimate: Minor | null };
  cycle: { id: string; startDate: ISODate; salary: Minor; paydaySeenAt: string | null } | null;
  snapshot: OpenCycle | null;
  transactions: TxnRow[];
  topUps?: { id: string; amount: Minor }[];
  discovery: DiscoveryProgress | null;
  /** The last closed cycle's entries, editable until the next salary lands. */
  adjustable: { cycleId: string; startDate: ISODate; endDate: ISODate; transactions: TxnRow[] } | null;
  /** Stakes override: savings keep getting drained, so every tone uses the warm voice. */
  stakes: boolean;
  phase: {
    phase: Phase;
    next: Phase | null;
    unlocksAround: ISODate | null;
    celebrate: { from: Phase; to: Phase } | null;
  } | null;
  target: { id: string; name: string; amountLeft: Minor; originalAmount: Minor } | null;
  sweepOffer: {
    week: number;
    amount: Minor;
    target: { id: string; name: string };
    goal: { name: string; emoji: string } | null;
  } | null;
  insights: Insight[];
  debtPayments: { debtId: string; amount: Minor }[];
  /** The last closed cycle's savings rate in basis points, for "Up from 29% last cycle". */
  lastRateBp: number | null;
};

/** The tone copy should speak in right now, and whether the stakes override applies. */
export const voiceOf = (d: Pick<TodayData, "prefs" | "stakes">) => ({
  tone: d.prefs.personality,
  stakes: d.stakes,
});

/** The Payday flow is owed when Payday mode is on and this cycle hasn't shown it yet. */
export const paydayDue = (d: TodayData) => !!d.budget.paydayMode && !!d.cycle && !d.cycle.paydaySeenAt;

const SWEEP_LATER_KEY = "cf.sweep.later";
const sweepId = (d: TodayData) => (d.cycle && d.sweepOffer ? `${d.cycle.id}:${d.sweepOffer.week}` : null);

/** "Decide later" on the sweep screen: Today stops redirecting to it for the rest of this browser session. */
export function postponeSweep(d: TodayData) {
  try {
    const id = sweepId(d);
    if (id) sessionStorage.setItem(SWEEP_LATER_KEY, id);
  } catch {
    // Storage blocked: the offer just comes back next time.
  }
}

/** Whether the sweep screen is owed: an offer exists, it's not discovery, and it hasn't been put off. */
export function sweepDue(d: TodayData) {
  if (!d.sweepOffer || d.budget.discovery) return false;
  try {
    return sessionStorage.getItem(SWEEP_LATER_KEY) !== sweepId(d);
  } catch {
    return true;
  }
}

const SEEN_KEY = "cf.insights.seen";
const localDay = () => new Date().toLocaleDateString("en-CA");

function readSeen(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

/** Insight keys shown on an earlier day in the last two days. Today's own picks stay put until tomorrow. */
function recentInsights(): InsightKey[] {
  const today = localDay();
  const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toLocaleDateString("en-CA");
  return Object.entries(readSeen())
    .filter(([, day]) => day < today && day >= twoDaysAgo)
    .map(([k]) => k as InsightKey);
}

export function markInsightsSeen(keys: InsightKey[]) {
  try {
    const seen = readSeen();
    const today = localDay();
    for (const k of keys) if (seen[k] !== today) seen[k] = today;
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    // Storage can be unavailable; insights just won't rotate for this viewer.
  }
}

export const todayQuery = queryOptions({
  queryKey: ["today"],
  queryFn: () => {
    const recent = recentInsights();
    return api<TodayData>(recent.length ? `/today?recent=${recent.join(",")}` : "/today").then(applyPhasePreview);
  },
  refetchOnWindowFocus: true,
});
