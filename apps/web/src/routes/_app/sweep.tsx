import { createFileRoute, redirect } from "@tanstack/react-router";
import { SweepOffer } from "../../features/phases/PhaseScreens";
import { todayQuery } from "../../lib/today";

export const Route = createFileRoute("/_app/sweep")({
  loader: async ({ context }) => {
    const data = await context.queryClient.ensureQueryData(todayQuery);
    if (!data.sweepOffer) throw redirect({ to: "/" });
  },
  component: SweepOffer,
});
