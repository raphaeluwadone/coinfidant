import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "../../../components/ComingSoon";

export const Route = createFileRoute("/_app/_shell/goals")({
  component: () => <ComingSoon title="Goals" line="Your goals are loading their luggage. Coming soon." />,
});
