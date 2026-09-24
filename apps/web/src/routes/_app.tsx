import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { meQuery } from "../lib/auth";
import { budgetQuery } from "../lib/budget";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(meQuery);
    if (!user) throw redirect({ to: "/login" });
    const budget = await context.queryClient.ensureQueryData(budgetQuery);
    if (!budget && location.pathname !== "/setup") throw redirect({ to: "/setup" });
    return { user, budget };
  },
  component: Outlet,
});
