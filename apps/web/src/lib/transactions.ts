import type { TransactionInput } from "@coinfidant/contracts";
import { api } from "./api";
import type { TodayData, TxnRow } from "./today";

export const logTransaction = (input: TransactionInput) =>
  api<{ transaction: TxnRow; today: TodayData }>("/transactions", { method: "POST", json: input });

export const deleteTransaction = (id: string) => api<{ today: TodayData }>(`/transactions/${id}`, { method: "DELETE" });

export const markSalaryReceived = (input: { amount?: number; receivedOn?: string } = {}) =>
  api<{ today: TodayData }>("/cycles/salary", { method: "POST", json: input });
