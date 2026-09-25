import type { SetupInput } from "@coinfidant/contracts";
import type { CurrencyCode, ISODate, Minor } from "@coinfidant/engine";
import { queryOptions } from "@tanstack/react-query";
import { api, ApiError } from "./api";

export type Bill = { id?: string; name: string; amount: Minor };
export type Category = { id: string; name: string; emoji: string; slug: string | null; archivedAt: string | null };

export type Budget = {
  id: string;
  currency: CurrencyCode;
  savingsPercent: number;
  expectedPayday: number;
  incomes: { id: string; name: string; amount: Minor; kind: string }[];
  bills: Bill[];
  categories: Category[];
  sinkingFunds: { id: string; name: string; target: Minor; saved: Minor; dueDate: ISODate }[];
  debts: {
    id: string;
    name: string;
    creditor: string;
    amountLeft: Minor;
    plan: "oneOff" | "installments" | "flexible";
    minAmount: Minor | null;
    idealAmount: Minor | null;
  }[];
  commitments: { id: string; name: string; minAmount: Minor; idealAmount: Minor }[];
  goals: { id: string; name: string; emoji: string; target: Minor; saved: Minor }[];
  paydayMode: boolean;
  discovery: boolean;
};

export type Prefs = { timezone: string; personality: "gentle" | "cheeky" | "unhinged"; displayName: string | null };

export type BudgetData = { budget: Budget; prefs: Prefs; openCycle: { id: string; startDate: ISODate } | null };

export const budgetQuery = queryOptions({
  queryKey: ["budget"],
  queryFn: async (): Promise<BudgetData | null> => {
    try {
      return await api<BudgetData>("/budget");
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },
});

export const salaryOf = (b: Budget) => b.incomes.find((i) => i.kind === "salary")?.amount ?? 0;

export const saveSetup = (input: SetupInput) =>
  api<{ budget: Budget }>("/budget/setup", { method: "POST", json: input });
