import { createFileRoute } from "@tanstack/react-router";
import { FundDetail } from "../../../../features/phases/PhaseScreens";
import { budgetQuery } from "../../../../lib/budget";
import { todayQuery } from "../../../../lib/today";

export const Route = createFileRoute("/_app/_shell/funds/$id")({
  loader: ({ context }) =>
    Promise.all([context.queryClient.prefetchQuery(todayQuery), context.queryClient.prefetchQuery(budgetQuery)]),
  component: FundPage,
});

function FundPage() {
  return <FundDetail id={Route.useParams().id} />;
}
