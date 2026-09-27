import { formatMoney } from "@coinfidant/engine";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { BackButton } from "../../components/BackButton";
import { cycleQuery, rangeLabel, ratePercent } from "../../lib/cycles";
import { paydayDue, todayQuery } from "../../lib/today";
import type { Learned } from "../../lib/transactions";
import { learnedQueryKey } from "../discovery/Discovery";
import { CycleCoach } from "./CycleCoach";
import "../payday/Flow.css";
import "./WrapUp.css";

/** The closed cycle's summary. `flow` means it was reached from marking salary received, so it leads on. */
export function WrapUp({ id, flow }: { id: string; flow: boolean }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: c, isError } = useQuery(cycleQuery(id));
  const { data: today } = useQuery(todayQuery);
  const currency = today?.currency ?? "NGN";

  if (isError)
    return (
      <main className="flow flow--center">
        <BackButton fallback="/history" corner />
        That cycle isn't here.
      </main>
    );
  if (!c) return <main className="flow" aria-busy="true" />;
  const s = c.snapshot;

  const next = () => {
    if (!flow) return navigate({ to: "/history" });
    if (qc.getQueryData<Learned | null>(learnedQueryKey)) return navigate({ to: "/discovery/complete" });
    if (today && paydayDue(today)) return navigate({ to: "/payday" });
    navigate({ to: "/" });
  };

  const swept = s.savings.swept + s.savings.sweptToDebts.reduce((a, d) => a + d.amount, 0);

  return (
    <main className="flow wrap">
      {!flow && <BackButton fallback="/history" />}
      <div className="wrap__range">{rangeLabel(c.startDate, c.endDate).toUpperCase()} CYCLE</div>
      <h1 className="flow__title">Cycle wrap-up</h1>

      <div className="wrap__stats">
        <div className="wrap__stat">
          <div className="wrap__stat-label">SAVED</div>
          <div className="wrap__stat-value">{formatMoney(s.savings.net, currency)}</div>
        </div>
        <div className="wrap__stat">
          <div className="wrap__stat-label">SAVINGS RATE</div>
          <div className={`wrap__stat-value ${s.savingsRateBp >= 0 ? "is-good" : "is-low"}`}>
            {ratePercent(s.savingsRateBp)}
          </div>
        </div>
      </div>

      <section className="wrap__card">
        <h2>How it went</h2>
        <ul className="wrap__facts">
          <li>
            <span>Spent</span>
            <strong>{formatMoney(s.spent, currency)}</strong>
          </li>
          <li>
            <span>Swept from weeks</span>
            <strong>{formatMoney(swept, currency)}</strong>
          </li>
          {s.savings.borrowed > 0 && (
            <li>
              <span>Borrowed from savings</span>
              <strong>{formatMoney(s.savings.borrowed, currency)}</strong>
            </li>
          )}
          {c.sweptToDebts.map((d) => (
            <li key={d.debtId}>
              <span>Swept onto {d.name}</span>
              <strong>{formatMoney(d.amount, currency)}</strong>
            </li>
          ))}
        </ul>
      </section>

      {c.pendingDebts.length > 0 && (
        <section className="wrap__card wrap__card--pending">
          <h2>Still owed from this cycle</h2>
          <ul className="wrap__facts">
            {c.pendingDebts.map((d) => (
              <li key={d.id}>
                <span>{d.name}</span>
                <strong>{formatMoney(d.unpaid, currency)}</strong>
              </li>
            ))}
          </ul>
          <p>These roll into the new cycle and stay flagged until they're marked paid.</p>
        </section>
      )}

      <CycleCoach cycleId={c.id} />

      {c.status === "closed" && (
        <p className="wrap__note">
          Forgot something? You can still log or fix this cycle's entries until your next payday.
        </p>
      )}

      <div className="flow__spacer" />
      <button className="btn flow__cta" onClick={next} autoFocus>
        {flow ? "On to the new cycle" : "Back to history"}
      </button>
    </main>
  );
}
