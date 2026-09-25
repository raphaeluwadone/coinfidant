import { createFileRoute, redirect } from "@tanstack/react-router";
import { Today } from "../../../features/today/Today";
import { paydayDue, todayQuery } from "../../../lib/today";

export const Route = createFileRoute("/_app/_shell/")({
  loader: async ({ context }) => {
    const data = await context.queryClient.ensureQueryData(todayQuery);
    if (paydayDue(data)) throw redirect({ to: "/payday" });
  },
  component: TodayPage,
});

function TodayPage() {
  return <Today user={Route.useRouteContext().user} />;
}
