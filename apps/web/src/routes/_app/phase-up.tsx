import { createFileRoute, redirect } from "@tanstack/react-router";
import { PhaseUp } from "../../features/phases/PhaseScreens";
import { todayQuery } from "../../lib/today";

export const Route = createFileRoute("/_app/phase-up")({
  loader: async ({ context }) => {
    const data = await context.queryClient.ensureQueryData(todayQuery);
    if (!data.phase?.celebrate) throw redirect({ to: "/" });
  },
  component: PhaseUp,
});
