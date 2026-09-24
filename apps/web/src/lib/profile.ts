import type { ProfileInput } from "@coinfidant/contracts";
import type { CurrencyCode, Minor } from "@coinfidant/engine";
import { queryOptions } from "@tanstack/react-query";
import { api, ApiError } from "./api";

export type Bill = { id?: string; name: string; amount: Minor };

export type Profile = {
  salary: Minor;
  savingsPercent: number;
  payday: number;
  timezone: string;
  currency: CurrencyCode;
  personality: "gentle" | "cheeky" | "unhinged";
  bills: Bill[];
};

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async (): Promise<Profile | null> => {
    try {
      return (await api<{ profile: Profile }>("/profile")).profile;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },
});

export const saveProfile = async (input: ProfileInput) =>
  (await api<{ profile: Profile }>("/profile", { method: "PUT", json: input })).profile;
