import { createFileRoute } from "@tanstack/react-router";
import { Today } from "../../../features/today/Today";
import { todayQuery } from "../../../lib/today";

export const Route = createFileRoute("/_app/_shell/")({
  loader: ({ context }) => context.queryClient.prefetchQuery(todayQuery),
  component: TodayPage,
});

function TodayPage() {
  return <Today user={Route.useRouteContext().user} />;
}
