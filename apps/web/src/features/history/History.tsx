import { formatMoney, quipsFor, type Tone, todayMood, weekLine } from "@coinfidant/engine";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { cycleMonth, type CycleSummary, historyQuery, rangeLabel, ratePercent } from "../../lib/cycles";
import { todayQuery, type TodayData } from "../../lib/today";
import "./History.css";

export function History() {
  const [tab, setTab] = useState<"cycle" | "all">("cycle");
  const { data: today } = useQuery(todayQuery);
  const { data: cycles = [] } = useQuery(historyQuery);

  return (
    <div className="history">
      <h1>History</h1>
      <div className="history__tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "cycle"}
          className={tab === "cycle" ? "is-on" : ""}
          onClick={() => setTab("cycle")}
        >
          This cycle
        </button>
        <button
          role="tab"
          aria-selected={tab === "all"}
          className={tab === "all" ? "is-on" : ""}
          onClick={() => setTab("all")}
        >
          All time
        </button>
      </div>

      {tab === "cycle" ? (
        <>
          {today?.snapshot && <ThisCycle data={today} />}
          <PastCycles cycles={cycles.slice(0, 6)} />
        </>
      ) : (
        <AllTime cycles={cycles} currency={today?.currency ?? "NGN"} />
      )}
    </div>
  );
}

function ThisCycle({ data }: { data: TodayData }) {
  const s = data.snapshot!;
  const tone = data.prefs.personality as Tone;
  const money = (n: number) => formatMoney(n, data.currency);
  const weeks = s.weeks.filter((w) => w.status !== "future").reverse();

  return (
    <section>
      <h2 className="history__label">{cycleMonth(s.cycle.start, s.cycle.projectedEnd).toUpperCase()} CYCLE</h2>
      <ul className="card history__list">
        {weeks.map((w) => {
          const title = `Week ${w.index + 1} · ${w.status === "current" ? "in progress" : rangeLabel(w.start, w.end)}`;
          let line: string;
          let right: string;
          let kind = "";
          if (w.status === "current") {
            line = quipsFor(data.discovery ? "onTrack" : todayMood(s), tone, { stakes: data.stakes })[0]!;
            right = `${money(s.today.leftThisWeek)}`;
          } else if (w.outcome?.kind === "swept") {
            line = weekLine(w.outcome, tone, money);
            right = `${money(w.outcome.amount)} swept`;
            kind = "is-good";
          } else {
            line = weekLine(w.outcome, tone, money);
            right = `${money(-(w.outcome?.amount ?? 0))} over`;
            kind = w.outcome?.kind === "over" && w.outcome.floorHit ? "is-floor" : "is-over";
          }
          return (
            <li key={w.index} className="history__row">
              <div className="history__main">
                <div className="history__title">{title}</div>
                <div className={`history__line ${kind}`}>{line}</div>
              </div>
              <div className="history__right">
                {right}
                {w.status === "current" && <span> left</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PastCycles({ cycles }: { cycles: CycleSummary[] }) {
  if (!cycles.length) return null;
  return (
    <section>
      <h2 className="history__label">PAST CYCLES</h2>
      <ul className="card history__list">
        {cycles.map((c) => (
          <li key={c.id}>
            <Link to="/cycles/$id" params={{ id: c.id }} className="history__row history__row--link">
              <span className="history__title">{cycleMonth(c.startDate, c.endDate)}</span>
              <span className="history__rate">{ratePercent(c.savingsRateBp)} saved</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AllTime({ cycles, currency }: { cycles: CycleSummary[]; currency: TodayData["currency"] }) {
  if (!cycles.length)
    return <p className="history__empty">Your first cycle closes on your next payday. Its story starts here.</p>;
  const saved = cycles.reduce((a, c) => a + c.saved, 0);
  const avg = Math.round(cycles.reduce((a, c) => a + c.savingsRateBp, 0) / cycles.length);
  return (
    <>
      <div className="history__stats">
        <div className="card history__stat">
          <div className="history__stat-label">SAVED IN TOTAL</div>
          <div className="history__stat-value">{formatMoney(saved, currency)}</div>
        </div>
        <div className="card history__stat">
          <div className="history__stat-label">AVERAGE RATE</div>
          <div className="history__stat-value is-good">{ratePercent(avg)}</div>
        </div>
      </div>
      <ul className="card history__list">
        {cycles.map((c) => (
          <li key={c.id}>
            <Link to="/cycles/$id" params={{ id: c.id }} className="history__row history__row--link">
              <div className="history__main">
                <div className="history__title">{cycleMonth(c.startDate, c.endDate)}</div>
                <div className="history__line">
                  {rangeLabel(c.startDate, c.endDate)} · {formatMoney(c.saved, currency)} saved
                </div>
              </div>
              <span className="history__rate">{ratePercent(c.savingsRateBp)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
