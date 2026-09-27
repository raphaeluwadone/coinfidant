import { say, type Tone } from "@coinfidant/engine";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { cycleMonth, ratePercent } from "../../lib/cycles";
import { type Growth as GrowthData, growthQuery } from "../../lib/growth";
import { todayQuery } from "../../lib/today";
import "./Growth.css";

const TREND = { up: "↑ trending up", down: "↓ dipping", flat: "→ holding steady" } as const;

export function Growth() {
  const { data } = useQuery(growthQuery);
  const { data: today } = useQuery(todayQuery);
  if (!data || !today) return <div className="growth" aria-busy="true" />;
  const tone: Tone = today.stakes ? "gentle" : today.prefs.personality;

  return (
    <div className="growth">
      <h1>Growth</h1>
      <RateChart rates={data.rates} trend={data.trend} />

      {today.discovery ? (
        <div className="streak">
          <span className="streak__emoji" aria-hidden="true">
            🔍
          </span>
          <div>
            <div className="streak__title">No streaks this month</div>
            <div className="streak__sub">We're learning your pattern first. No pressure.</div>
          </div>
        </div>
      ) : (
        <div className="streak">
          <span className={`streak__emoji ${data.streak > 0 ? "is-lit" : ""}`} aria-hidden="true">
            🔥
          </span>
          <div>
            <div className="streak__title">{data.streak}-day streak</div>
            <div className="streak__sub">
              {data.streak > 0 ? say("streak.line", tone, { count: data.streak }) : "Log something today to start one."}
            </div>
          </div>
        </div>
      )}

      <section>
        <h2>Badge shelf</h2>
        <ul className="badges">
          {data.badges.map((b) => (
            <li key={b.key} className={`badge ${b.earned ? "is-earned" : ""}`} title={b.how}>
              <span className="badge__emoji" aria-hidden="true">
                {b.emoji}
              </span>
              <span className="badge__name">{b.name}</span>
              <span className="sr-only">{b.earned ? "Earned." : `Locked. ${b.how}.`}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Savings rate per closed cycle, the latest in the accent. One series, so no legend; the title names it. */
function RateChart({ rates, trend }: Pick<GrowthData, "rates" | "trend">) {
  const max = Math.max(2000, ...rates.map((r) => r.rateBp));
  return (
    <Card asChild className="rates">
      <section>
        <div className="rates__head">
          <h2>Savings rate</h2>
          {rates.length > 1 && <span className={`rates__trend is-${trend}`}>{TREND[trend]}</span>}
        </div>
        {rates.length === 0 ? (
          <p className="rates__empty">Your first bar appears when this cycle closes on payday.</p>
        ) : (
          <>
            <div className="rates__plot" aria-hidden="true">
              {rates.map((r, i) => {
                const month = cycleMonth(r.startDate, r.endDate);
                const pct = Math.max(0, r.rateBp) / max;
                return (
                  <div key={r.startDate} className="rates__col" title={`${month}: ${ratePercent(r.rateBp)} saved`}>
                    <span className="rates__value">{ratePercent(r.rateBp)}</span>
                    <div
                      className={`rates__bar ${i === rates.length - 1 ? "is-latest" : ""}`}
                      style={{ height: `${Math.max(pct * 100, 2)}%`, animationDelay: `${i * 0.08}s` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="rates__labels" aria-hidden="true">
              {rates.map((r) => (
                <span key={r.startDate}>{cycleMonth(r.startDate, r.endDate).slice(0, 3)}</span>
              ))}
            </div>
            <table className="sr-only">
              <caption>Savings rate by cycle</caption>
              <tbody>
                {rates.map((r) => (
                  <tr key={r.startDate}>
                    <th scope="row">{cycleMonth(r.startDate, r.endDate)}</th>
                    <td>{ratePercent(r.rateBp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </Card>
  );
}
