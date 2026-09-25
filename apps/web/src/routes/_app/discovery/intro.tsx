import { createFileRoute } from "@tanstack/react-router";
import { DiscoveryIntro } from "../../../features/discovery/Discovery";

export const Route = createFileRoute("/_app/discovery/intro")({
  component: DiscoveryIntro,
});
