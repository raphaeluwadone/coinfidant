import type { ISODate, Minor, Snapshot } from "@coinfidant/engine";
import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";
import type { Profile } from "./profile";

export type SpendRow = {
  id: string;
  amount: Minor;
  category: string;
  note: string | null;
  occurredAt: string;
  localDate: ISODate;
};

export type TodayData = { profile: Profile; snapshot: Snapshot; spends: SpendRow[] };

export const todayQuery = queryOptions({
  queryKey: ["today"],
  queryFn: () => api<TodayData>("/today"),
  refetchOnWindowFocus: true,
});
