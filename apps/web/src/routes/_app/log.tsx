import { createFileRoute } from "@tanstack/react-router";
import { QuickLog } from "../../features/log/QuickLog";
import { todayQuery } from "../../lib/today";

export const Route = createFileRoute("/_app/log")({
  loader: ({ context }) => context.queryClient.prefetchQuery(todayQuery),
  component: QuickLog,
});
