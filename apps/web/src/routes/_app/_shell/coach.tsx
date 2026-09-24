import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "../../../components/ComingSoon";

export const Route = createFileRoute("/_app/_shell/coach")({
  component: () => <ComingSoon title="Coach" line="Your coach is still stretching. Coming soon." />,
});
