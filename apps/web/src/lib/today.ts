import type { CurrencyCode, DiscoveryProgress, ISODate, Minor, OpenCycle } from "@coinfidant/engine";
import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";
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
};

/** The Payday flow is owed when Payday mode is on and this cycle hasn't shown it yet. */
export const paydayDue = (d: TodayData) => !!d.budget.paydayMode && !!d.cycle && !d.cycle.paydaySeenAt;

export const todayQuery = queryOptions({
  queryKey: ["today"],
  queryFn: () => api<TodayData>("/today"),
  refetchOnWindowFocus: true,
});
