import { formatMoney, insightText, type Phase, PHASES, say, type Tone } from "@coinfidant/engine";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { api } from "../../lib/api";
import { budgetQuery } from "../../lib/budget";
import { billEmoji, creditorEmoji } from "../../lib/emoji";
import { markInsightsSeen, todayQuery, type TodayData } from "../../lib/today";
import "./Phases.css";

const monthName = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", month: "long" });

/** Always-visible Stabilise → Attack → Build strip with a one-line caption. */
export function JourneyStrip({ phase }: { phase: NonNullable<TodayData["phase"]> }) {
  const at = PHASES.findIndex((p) => p.key === phase.phase);
  const current = PHASES[at]!;
  const next = PHASES.find((p) => p.key === phase.next);
  const caption = next
    ? phase.unlocksAround
      ? `You're in ${current.label}. ${next.label} unlocks around ${monthName(phase.unlocksAround)}`
      : `You're in ${current.label}. ${next.label} comes next`
    : `You're in ${current.label}. Nothing left to hunt, only to grow`;
  return (
    <section className="journey" aria-label={caption}>
      <div className="journey__track" aria-hidden="true">
        {PHASES.map((p, i) => (
          <div key={p.key} className="journey__step">
            {i > 0 && (
              <span className="journey__line">
                <span className={i <= at ? "is-done" : ""} />
              </span>
            )}
            <div className={`journey__node ${i === at ? "is-current" : i > at ? "is-future" : "is-past"}`}>
              <span className="journey__dot">{p.emoji}</span>
              <span className="journey__name">{p.label.toUpperCase()}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="journey__caption">{caption}</p>
    </section>
  );
}

export function PhasePill({ phase }: { phase: Phase }) {
  const p = PHASES.find((x) => x.key === phase)!;
  return (
    <span className="phase-pill">
      {p.emoji} {p.label}
    </span>
  );
}

/** The phase's hero line, rotated in with the day's quips. */
export function phaseLine(data: TodayData, tone: Tone): string | null {
  const s = data.snapshot;
  const phase = data.phase?.phase;
  if (!s || !phase || data.budget.discovery) return null;
  const opts = { stakes: data.stakes };
  if (phase === "attack") {
    const extra =
      s.plan.debts.reduce((a, d) => a + d.rolledIn, 0) + s.savings.sweptToDebts.reduce((a, d) => a + d.amount, 0);
    return extra > 0 ? say("phase.attack", tone, { amount: formatMoney(extra, data.currency) }, opts) : null;
  }
  return say(phase === "build" ? "phase.build" : "phase.stabilise", tone, {}, opts);
}

/** 2–3 things worth knowing today, from the rules layer, in the viewer's tone. */
export function WorthKnowing({ data }: { data: TodayData }) {
  const tone = data.prefs.personality;
  const money = (n: number) => formatMoney(n, data.currency);
  useEffect(() => {
    markInsightsSeen(data.insights.map((x) => x.key));
  }, [data.insights]);
  if (!data.insights.length) return null;
  return (
    <section className="card worth">
      <h2>Worth knowing</h2>
      <ul>
        {data.insights.map((x) => (
          <li key={x.key} className={`worth__item is-${x.severity}`}>
            <span aria-hidden="true">{x.emoji}</span>
            <span>{insightText(x, tone, money, { stakes: data.stakes })}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One supporting card per phase: commitments (Stabilise), the boss fight (Attack), goals (Build). */
export function PhaseCard({ data }: { data: TodayData }) {
  const phase = data.phase?.phase ?? "build";
  if (phase === "stabilise") return <Commitments data={data} />;
  if (phase === "attack") return <BossFight data={data} />;
  return <Goals data={data} />;
}

type CheckRow = {
  key: string;
  label: string;
  amount: number;
  done: boolean;
  status: string;
  fund?: string;
  payId?: string;
  payAmount?: number;
};

function Commitments({ data }: { data: TodayData }) {
  const qc = useQueryClient();
  const { data: b } = useQuery(budgetQuery);
  const s = data.snapshot!;
  const money = (n: number) => formatMoney(n, data.currency);
  const pay = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      api(`/debts/${id}/payments`, { method: "POST", json: { amount } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: todayQuery.queryKey }),
  });
  if (!b) return null;

  const paid = (id: string) => data.debtPayments.filter((p) => p.debtId === id).reduce((a, p) => a + p.amount, 0);
  const rows: CheckRow[] = [
    ...b.budget.bills.map((x) => ({
      key: `b${x.id}`,
      label: `${billEmoji(x.name)} ${x.name}`,
      amount: x.amount,
      done: true,
      status: "Set aside",
    })),
    ...s.plan.sinking
      .filter((f) => f.setAside > 0)
      .map((f) => {
        const fund = b.budget.sinkingFunds.find((x) => x.id === f.id);
        return {
          key: f.id,
          label: `🪣 ${fund?.name ?? "Fund"} fund`,
          amount: f.setAside,
          done: true,
          status: "Set aside",
          fund: f.id,
        };
      }),
    ...s.plan.debts
      .filter((d) => d.due > 0)
      .map((d) => {
        const debt = b.budget.debts.find((x) => x.id === d.id);
        const left = d.due - paid(d.id);
        return {
          key: d.id,
          label: `${creditorEmoji(debt?.creditor ?? "")} ${debt?.name ?? "Debt"} min`,
          amount: d.due,
          done: left <= 0,
          status: left <= 0 ? "Paid" : "Due",
          payId: left > 0 ? d.id : undefined,
          payAmount: left,
        };
      }),
    ...s.plan.commitments
      .filter((c) => c.amount > 0)
      .map((c) => {
        const who = b.budget.commitments.find((x) => x.id === c.id);
        return { key: c.id, label: `👤 ${who?.name ?? "Someone"}`, amount: c.amount, done: true, status: "Set aside" };
      }),
  ];

  return (
    <section className="card phase-card">
      <h2>This cycle's commitments</h2>
      {rows.length === 0 ? (
        <p className="phase-card__empty">Nothing fixed this cycle.</p>
      ) : (
        <ul className="checklist">
          {rows.map((r) => (
            <li key={r.key} className={r.done ? "is-done" : ""}>
              <span className="checklist__dot" aria-hidden="true">
                {r.done ? "✓" : ""}
              </span>
              <span className="checklist__label">
                {r.fund ? (
                  <Link to="/funds/$id" params={{ id: r.fund }}>
                    {r.label}
                  </Link>
                ) : (
                  r.label
                )}{" "}
                · {money(r.amount)}
              </span>
              {r.payId ? (
                <button
                  className="checklist__pay"
                  disabled={pay.isPending}
                  onClick={() => pay.mutate({ id: r.payId!, amount: r.payAmount! })}
                >
                  Mark paid
                </button>
              ) : (
                <span className="checklist__status">{r.status}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export const hpPercent = (left: number, original: number) =>
  original > 0 ? Math.max(0, Math.min(100, Math.round(((original - left) / original) * 100))) : 0;

function BossFight({ data }: { data: TodayData }) {
  const t = data.target;
  if (!t) return null;
  const plan = data.snapshot!.plan.debts.find((d) => d.id === t.id);
  const down = hpPercent(t.amountLeft, t.originalAmount);
  return (
    <section className="card phase-card">
      <div className="phase-card__head">
        <h2>Current target</h2>
        <span className="phase-card__tag">🔥 Boss fight</span>
      </div>
      <div className="boss__row">
        <strong>{t.name}</strong>
        <strong>{formatMoney(t.amountLeft, data.currency)} left</strong>
      </div>
      <div
        className="hp"
        role="progressbar"
        aria-valuenow={down}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${down}% paid off`}
      >
        <div className="hp__fill is-target" style={{ width: `${Math.max(100 - down, 2)}%` }} />
      </div>
      <div className="boss__meta">
        {down}% HP down
        {plan && plan.rolledIn > 0 && ` · ${formatMoney(plan.rolledIn, data.currency)} snowballed in this cycle`}
      </div>
      <Link to="/debts" className="link-btn phase-card__link">
        Debt board →
      </Link>
    </section>
  );
}

function Goals({ data }: { data: TodayData }) {
  const { data: b } = useQuery(budgetQuery);
  const s = data.snapshot!;
  const rate = s.plan.salary > 0 ? Math.round((s.savings.net / s.plan.salary) * 100) : 0;
  const goals = b?.budget.goals ?? [];
  return (
    <section className="card phase-card">
      <div className="phase-card__head">
        <h2>Savings rate this cycle</h2>
        <strong className="phase-card__rate">{rate}%</strong>
      </div>
      {goals.length === 0 ? (
        <p className="phase-card__empty">Add a goal and your savings get somewhere to go.</p>
      ) : (
        <ul className="goals">
          {goals.map((g) => {
            const pct = g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
            return (
              <li key={g.id}>
                <div className="goals__row">
                  <span>
                    {g.emoji} {g.name}
                  </span>
                  <span>
                    {formatMoney(g.saved, data.currency)} / {formatMoney(g.target, data.currency)}
                  </span>
                </div>
                <div className="hp hp--goal" aria-hidden="true">
                  <div className="hp__fill is-goal" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
