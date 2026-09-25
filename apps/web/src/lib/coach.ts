import type { CoachPace, CoachReview, ISODate } from "@coinfidant/engine";
import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";

export type StoredReview = {
  id: string;
  cycleId: string;
  cycleStart: ISODate;
  kind: "week" | "cycle";
  /** Null for a cycle wrap-up. */
  weekIndex: number | null;
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

export type CycleCoachData = {
  available: boolean;
  cap: number;
  used: number;
  remaining: number;
  /** Only the latest closed cycle can get new reads. */
  reviewable: boolean;
  current: Pick<StoredReview, "id" | "pace" | "review" | "createdAt"> | null;
};

export const cycleCoachQuery = (id: string) =>
  queryOptions({ queryKey: ["coach", "cycle", id], queryFn: () => api<CycleCoachData>(`/coach/cycles/${id}`) });

export const askCycleCoach = (id: string, fresh: boolean) =>
  api<CycleCoachData>(`/coach/cycles/${id}/reviews`, { method: "POST", json: { fresh } });
