import { createFileRoute } from "@tanstack/react-router";
import { History } from "../../../features/history/History";
import { historyQuery } from "../../../lib/cycles";
import { todayQuery } from "../../../lib/today";

export const Route = createFileRoute("/_app/_shell/history")({
  loader: ({ context }) =>
    Promise.all([context.queryClient.prefetchQuery(todayQuery), context.queryClient.prefetchQuery(historyQuery)]),
  component: History,
});
