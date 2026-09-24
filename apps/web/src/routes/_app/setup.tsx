import { createFileRoute } from "@tanstack/react-router";
import { SetupForm } from "../../features/setup/SetupForm";

export const Route = createFileRoute("/_app/setup")({
  component: SetupPage,
});

function SetupPage() {
  return <SetupForm initial={Route.useRouteContext().budget} />;
}
