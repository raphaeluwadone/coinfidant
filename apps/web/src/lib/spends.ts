import type { SpendInput } from "@coinfidant/contracts";
import { api } from "./api";
import type { SpendRow, TodayData } from "./today";

export const logSpend = (input: SpendInput) =>
  api<{ spend: SpendRow; today: TodayData }>("/spends", { method: "POST", json: input });

export const deleteSpend = (id: string) => api<{ today: TodayData }>(`/spends/${id}`, { method: "DELETE" });
