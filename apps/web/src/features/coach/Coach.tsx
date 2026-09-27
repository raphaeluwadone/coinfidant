import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mascot } from "@/components/Mascot";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApiError } from "@/lib/api";
import { askCoach, type CoachData, coachQuery, type StoredReview } from "@/lib/coach";
import "./Coach.css";
import { PageHeader } from "@/components/PageHeader";

const FAILED: Record<string, string> = {
  coach_cap: "That's all the reads for this cycle. Fresh ones arrive with your next salary.",
  coach_unavailable: "The coach is offline right now. Your numbers are all still on Today.",
  coach_failed: "The coach fumbled that one. Try again in a moment?",
  no_open_cycle: "Mark your salary as landed first, then there's a week to review.",
};

export function Coach() {
  const qc = useQueryClient();
  const { data, isPending } = useQuery(coachQuery);
  const ask = useMutation({
    mutationFn: (fresh: boolean) => askCoach(fresh),
    onSuccess: (next) => qc.setQueryData(coachQuery.queryKey, next),
  });
  if (isPending || !data) return <div className="coach" aria-busy="true" />;

  const error = ask.error instanceof ApiError ? (FAILED[ask.error.code] ?? FAILED.coach_failed) : null;
  const focus = data.focus?.inProgress === false ? "last week" : "this week";

  return (
    <div className="coach">
      <PageHeader
        eyebrow="Coach"
        title={
          <span className="inline-flex items-center gap-3">
            <Mascot size={44} float={false} /> Pix's read
          </span>
        }
        sub="Your week, from your totals. Never your notes."
      />

      {data.current ? (
        <ReviewCards
          review={data.current}
          verdict={focus === "this week" ? "THIS WEEK'S VERDICT" : "LAST WEEK'S VERDICT"}
          target="TARGET FOR NEXT WEEK"
        />
      ) : (
        <Card asChild className="coach__intro">
          <section>
            <h2>Want a read on {focus}?</h2>
            <p>
              Pix looks at your weekly totals and category split, never your notes, and tells you what's working and
              what to aim for next.
            </p>
          </section>
        </Card>
      )}

      {data.available ? (
        <div className="coach__ask">
          <Button
            className="w-full"
            disabled={ask.isPending || (!!data.current && data.remaining === 0)}
            onClick={() => ask.mutate(!!data.current)}
          >
            {ask.isPending ? "Reading the tea leaves…" : data.current ? "Ask for another read 🔮" : "Get my read 🔮"}
          </Button>
          <span className="coach__left">{remainingLabel(data)}</span>
        </div>
      ) : (
        <p className="coach__note">{FAILED.coach_unavailable}</p>
      )}
      {error && (
        <p className="coach__note" role="alert">
          {error}
        </p>
      )}

      {data.history.length > 0 && (
        <section className="coach__history">
          <h2>Earlier reads</h2>
          <ul>
            {data.history.map((h) => (
              <Card asChild key={h.id}>
                <li>
                  <details>
                    <summary>
                      <span>{when(h)}</span>
                      <strong className={`pace-${h.pace}`}>{h.review.verdict.label}</strong>
                    </summary>
                    <p>{h.review.verdict.line}</p>
                    <p>
                      <strong>Target:</strong> {h.review.target}
                    </p>
                  </details>
                </li>
              </Card>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function ReviewCards({
  review: r,
  verdict,
  target,
}: {
  review: Pick<StoredReview, "pace" | "review">;
  verdict: string;
  target: string;
}) {
  return (
    <>
      <Card asChild className="coach__verdict">
        <section>
          <div className="coach__eyebrow">{verdict}</div>
          <div className={`coach__label pace-${r.pace}`}>{r.review.verdict.label}</div>
          <p>{r.review.verdict.line}</p>
        </section>
      </Card>
      <section className="coach__lever">
        <div className="coach__eyebrow">🔍 BIGGEST LEVER</div>
        <p>{r.review.lever}</p>
      </section>
      <Card asChild className="coach__target">
        <section>
          <div className="coach__eyebrow">🎯 {target}</div>
          <p>{r.review.target}</p>
        </section>
      </Card>
      <Card asChild className="coach__long">
        <section>
          <div className="coach__eyebrow">🔭 THE LONG VIEW</div>
          <p>{r.review.observation}</p>
        </section>
      </Card>
    </>
  );
}

const remainingLabel = (d: CoachData) =>
  d.remaining === 0 ? "No reads left this cycle" : `${d.remaining} of ${d.cap} reads left this cycle`;

const when = (h: StoredReview) => {
  const month = new Date(`${h.cycleStart}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", month: "short" });
  return h.weekIndex === null ? `${month} cycle wrap-up` : `${month} cycle · week ${h.weekIndex + 1}`;
};
