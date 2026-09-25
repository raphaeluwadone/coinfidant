import { createFileRoute } from "@tanstack/react-router";
import { Transactions } from "../../../features/transactions/Transactions";
import { todayQuery } from "../../../lib/today";

export const Route = createFileRoute("/_app/_shell/transactions")({
  loader: ({ context }) => context.queryClient.prefetchQuery(todayQuery),
  component: Transactions,
});
