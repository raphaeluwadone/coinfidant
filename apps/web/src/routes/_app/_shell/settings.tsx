import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "../../../features/settings/Settings";
import { budgetQuery } from "../../../lib/budget";

export const Route = createFileRoute("/_app/_shell/settings")({
  loader: ({ context }) => context.queryClient.prefetchQuery(budgetQuery),
  component: Settings,
});
