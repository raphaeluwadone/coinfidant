import { createFileRoute, redirect } from "@tanstack/react-router";
import { PhaseFrame } from "../components/PhaseFrame";
import { meQuery } from "../lib/auth";
import { budgetQuery } from "../lib/budget";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(meQuery);
    if (!user) throw redirect({ to: "/login" });
    const budget = await context.queryClient.ensureQueryData(budgetQuery);
    const onboarding = location.pathname === "/onboarding";
    if (!budget && !onboarding) throw redirect({ to: "/onboarding" });
    if (budget && onboarding) throw redirect({ to: "/" });
    return { user, budget };
  },
  component: PhaseFrame,
});
