import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../lib/api";
import { askCycleCoach, cycleCoachQuery } from "../../lib/coach";
import { ReviewCards } from "../coach/Coach";
import "../coach/Coach.css";

const FAILED: Record<string, string> = {
  coach_cap: "That's both reads for this cycle.",
  coach_unavailable: "The coach is offline right now.",
  cycle_not_reviewable: "Only your most recent cycle can get a new read.",
};

/** Pix's wrap-up of a closed cycle, on its summary page. */
export function CycleCoach({ cycleId }: { cycleId: string }) {
  const qc = useQueryClient();
  const query = cycleCoachQuery(cycleId);
  const { data } = useQuery(query);
  const ask = useMutation({
    mutationFn: (fresh: boolean) => askCycleCoach(cycleId, fresh),
    onSuccess: (next) => {
      qc.setQueryData(query.queryKey, next);
      qc.invalidateQueries({ queryKey: ["coach"], exact: true });
    },
  });
  if (!data || (!data.current && (!data.reviewable || !data.available))) return null;

  const error =
    ask.error instanceof ApiError
      ? (FAILED[ask.error.code] ?? "The coach fumbled that one. Try again in a moment?")
      : null;

  return (
    <section className="coach coach--wrap" aria-label="Coach wrap-up">
      {data.current ? (
        <ReviewCards review={data.current} verdict="THIS CYCLE'S VERDICT" target="TARGET FOR NEXT CYCLE" />
      ) : (
        <div className="card coach__intro">
          <h2>Want Pix's take on this cycle?</h2>
          <p>A short wrap-up from your totals and categories, never your notes, plus one target for next cycle.</p>
        </div>
      )}
      {data.available && data.reviewable && (data.remaining > 0 || !data.current) && (
        <div className="coach__ask">
          <button className="btn btn--ghost" disabled={ask.isPending} onClick={() => ask.mutate(!!data.current)}>
            {ask.isPending
              ? "Reading the tea leaves…"
              : data.current
                ? "Ask for another read 🔮"
                : "Get the wrap-up read 🔮"}
          </button>
        </div>
      )}
      {error && (
        <p className="coach__note" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
