import type { CoachPace, CoachReview, ISODate } from "@coinfidant/engine";
import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";

export type StoredReview = {
  id: string;
  cycleId: string;
  cycleStart: ISODate;
  weekIndex: number;
  pace: CoachPace;
  review: CoachReview;
  createdAt: string;
};

export type CoachData = {
  available: boolean;
  cap: number;
  used: number;
  remaining: number;
  focus: { weekIndex: number; inProgress: boolean } | null;
  current: StoredReview | null;
  history: StoredReview[];
};

export const coachQuery = queryOptions({
  queryKey: ["coach"],
  queryFn: () => api<CoachData>("/coach"),
});

export const askCoach = (fresh: boolean) => api<CoachData>("/coach/reviews", { method: "POST", json: { fresh } });
