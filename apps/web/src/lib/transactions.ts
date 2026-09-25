import type { TransactionInput } from "@coinfidant/contracts";
import type { Minor } from "@coinfidant/engine";
import { api } from "./api";
import type { TodayData, TxnRow } from "./today";

export const logTransaction = (input: TransactionInput) =>
  api<{ transaction: TxnRow; today: TodayData }>("/transactions", { method: "POST", json: input });

export const deleteTransaction = (id: string) => api<{ today: TodayData }>(`/transactions/${id}`, { method: "DELETE" });

export type Learned = {
  categories: { categoryId: string; name: string; emoji: string; monthly: Minor }[];
  total: Minor;
};

export const markSalaryReceived = (input: { amount?: number; receivedOn?: string } = {}) =>
  api<{ today: TodayData; learned: Learned | null; closedCycleId: string | null }>("/cycles/salary", {
    method: "POST",
    json: input,
  });

export const markPaydaySeen = () => api<void>("/cycles/current/payday-seen", { method: "POST" });

export const setTopUp = (id: string, amount: Minor) =>
  api<TodayData>(`/cycles/current/top-ups/${id}`, { method: "PUT", json: { amount } });
