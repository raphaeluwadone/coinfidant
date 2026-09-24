import type { CurrencyCode, ISODate, Minor, OpenCycle } from "@coinfidant/engine";
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
  cycle: { id: string; startDate: ISODate; salary: Minor } | null;
  snapshot: OpenCycle | null;
  transactions: TxnRow[];
};

export const todayQuery = queryOptions({
  queryKey: ["today"],
  queryFn: () => api<TodayData>("/today"),
  refetchOnWindowFocus: true,
});
