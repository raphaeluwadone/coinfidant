import { createFileRoute } from "@tanstack/react-router";
import { Coach } from "../../../features/coach/Coach";
import { coachQuery } from "../../../lib/coach";

export const Route = createFileRoute("/_app/_shell/coach")({
  loader: ({ context }) => context.queryClient.prefetchQuery(coachQuery),
  component: Coach,
});
