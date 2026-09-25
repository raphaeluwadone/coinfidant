import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { WrapUp } from "../../../features/close/WrapUp";
import { cycleQuery } from "../../../lib/cycles";
import { todayQuery } from "../../../lib/today";

export const Route = createFileRoute("/_app/cycles/$id")({
  validateSearch: z.object({ flow: z.boolean().optional() }),
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.prefetchQuery(cycleQuery(params.id)),
      context.queryClient.prefetchQuery(todayQuery),
    ]),
  component: CyclePage,
});

function CyclePage() {
  const { id } = Route.useParams();
  return <WrapUp id={id} flow={!!Route.useSearch().flow} />;
}
