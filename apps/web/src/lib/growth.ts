import type { BadgeKey, ISODate, RateTrend } from "@coinfidant/engine";
import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";

export type Growth = {
  rates: { startDate: ISODate; endDate: ISODate; rateBp: number }[];
  trend: RateTrend;
  streak: number;
  badges: { key: BadgeKey; name: string; emoji: string; how: string; earned: boolean }[];
};

export const growthQuery = queryOptions({
  queryKey: ["growth"],
  queryFn: () => api<Growth>("/growth"),
  staleTime: 5 * 60_000,
});
