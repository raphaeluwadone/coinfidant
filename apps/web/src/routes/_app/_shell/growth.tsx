import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "../../../components/ComingSoon";

export const Route = createFileRoute("/_app/_shell/growth")({
  component: () => <ComingSoon title="Growth" line="Charts are doing push-ups. Coming soon." />,
});
