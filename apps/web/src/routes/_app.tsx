import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { meQuery } from "../lib/auth";
import { profileQuery } from "../lib/profile";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(meQuery);
    if (!user) throw redirect({ to: "/login" });
    const profile = await context.queryClient.ensureQueryData(profileQuery);
    if (!profile && location.pathname !== "/setup") throw redirect({ to: "/setup" });
    return { user, profile };
  },
  component: Outlet,
});
