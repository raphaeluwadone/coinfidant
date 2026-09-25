import { createFileRoute } from "@tanstack/react-router";
import { Payday } from "../../features/payday/Payday";
import { budgetQuery } from "../../lib/budget";
import { todayQuery } from "../../lib/today";

export const Route = createFileRoute("/_app/payday")({
  loader: ({ context }) =>
    Promise.all([context.queryClient.prefetchQuery(todayQuery), context.queryClient.prefetchQuery(budgetQuery)]),
  component: Payday,
});
