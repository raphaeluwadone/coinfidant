import { createFileRoute } from "@tanstack/react-router";
import { DiscoveryComplete } from "../../../features/discovery/Discovery";

export const Route = createFileRoute("/_app/discovery/complete")({
  component: DiscoveryComplete,
});
