import { createFileRoute } from "@tanstack/react-router";
import { DebtBoard } from "../../../features/phases/PhaseScreens";
import { budgetQuery } from "../../../lib/budget";
import { todayQuery } from "../../../lib/today";

export const Route = createFileRoute("/_app/_shell/debts")({
  loader: ({ context }) =>
    Promise.all([context.queryClient.prefetchQuery(todayQuery), context.queryClient.prefetchQuery(budgetQuery)]),
  component: DebtBoard,
});
