import type { ClosedCycle, ISODate, Minor } from "@coinfidant/engine";
import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";

export type CycleSummary = {
  id: string;
  startDate: ISODate;
  endDate: ISODate;
  status: "closed" | "locked";
  savingsRateBp: number;
  saved: Minor;
  spent: Minor;
};

export type CycleDetail = {
  id: string;
  status: "closed" | "locked";
  startDate: ISODate;
  endDate: ISODate;
  snapshot: ClosedCycle;
  pendingDebts: { id: string; name: string; amountLeft: Minor; unpaid: Minor }[];
  sweptToDebts: { debtId: string; name: string; amount: Minor }[];
};

export const historyQuery = queryOptions({
  queryKey: ["history"],
  queryFn: () => api<{ cycles: CycleSummary[] }>("/cycles/history").then((r) => r.cycles),
});

export const cycleQuery = (id: string) =>
  queryOptions({ queryKey: ["cycle", id], queryFn: () => api<CycleDetail>(`/cycles/${id}`) });

const shortDate = (d: ISODate) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });

/** "Sep 1 – Sep 30" (an en dash is right for a range). */
export const rangeLabel = (start: ISODate, end: ISODate) => `${shortDate(start)} – ${shortDate(end)}`;

/** A cycle is named after the month most of it falls in. */
export const cycleMonth = (start: ISODate, end: ISODate) => {
  const mid = new Date((Date.parse(`${start}T00:00:00Z`) + Date.parse(`${end}T00:00:00Z`)) / 2);
  return mid.toLocaleDateString("en-GB", { timeZone: "UTC", month: "long" });
};

export const ratePercent = (bp: number) => `${Math.round(bp / 100)}%`;
