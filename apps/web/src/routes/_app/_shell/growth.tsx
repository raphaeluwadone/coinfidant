import { createFileRoute } from "@tanstack/react-router";
import { Growth } from "../../../features/growth/Growth";
import { growthQuery } from "../../../lib/growth";
import { todayQuery } from "../../../lib/today";

export const Route = createFileRoute("/_app/_shell/growth")({
  loader: ({ context }) =>
    Promise.all([context.queryClient.prefetchQuery(growthQuery), context.queryClient.prefetchQuery(todayQuery)]),
  component: Growth,
});
