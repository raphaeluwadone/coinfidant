import { createFileRoute } from "@tanstack/react-router";
import { DiscoveryProgress } from "../../../features/discovery/Discovery";
import { todayQuery } from "../../../lib/today";

export const Route = createFileRoute("/_app/discovery/")({
  loader: ({ context }) => context.queryClient.prefetchQuery(todayQuery),
  component: DiscoveryProgress,
});
