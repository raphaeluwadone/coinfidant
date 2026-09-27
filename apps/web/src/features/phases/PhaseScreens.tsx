import { attackOrder, daysBetween, formatMoney, type Phase, PHASES, say } from "@coinfidant/engine";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { BackButton } from "../../components/BackButton";
import { api } from "../../lib/api";
import { budgetQuery } from "../../lib/budget";
import { creditorEmoji } from "../../lib/emoji";
import { postponeSweep, todayQuery, type TodayData } from "../../lib/today";
import { hpPercent } from "./PhaseParts";
import "./Phases.css";

/** Attack mode's board: the current target first, then the queue, then the defeated. */
export function DebtBoard() {
  const { data: b } = useQuery(budgetQuery);
  const { data: t } = useQuery(todayQuery);
  if (!b || !t) return null;
  const money = (n: number) => formatMoney(n, t.currency);
  const debts = b.budget.debts;
  const active = attackOrder(debts);
  const defeated = debts.filter((d) => d.amountLeft <= 0);
  const target = active[0];
  const planned = (id: string) => t.snapshot?.plan.debts.find((d) => d.id === id);
  const extra = t.snapshot?.plan.debts.reduce((a, d) => a + d.rolledIn, 0) ?? 0;

  return (
    <div className="board">
      <BackButton />
      <div>
        <h1>Debt board ⚔️</h1>
        <p className="board__sub">Most expensive dies first.{extra > 0 && ` Extra ${money(extra)}/cycle.`}</p>
      </div>
      {debts.length === 0 && <p className="card">No debts. Nothing to fight.</p>}
      <div className="board__list">
        {active.map((d) => {
          const isTarget = d.id === target?.id;
          const p = planned(d.id);
          const down = hpPercent(d.amountLeft, d.originalAmount);
          return (
            <section key={d.id} className={`card boss ${isTarget ? "is-target" : ""}`}>
              <span className="boss__tag">{isTarget ? "🔥 CURRENT TARGET" : "QUEUED"}</span>
              <div className="boss__row">
                <strong>
                  {creditorEmoji(d.creditor)} {d.name}
                </strong>
                <strong>{money(d.amountLeft)} HP</strong>
              </div>
              <div className="hp" aria-hidden="true">
                <div
                  className={`hp__fill ${isTarget ? "is-target" : "is-queued"}`}
                  style={{ width: `${Math.max(100 - down, 2)}%` }}
                />
              </div>
              <div className="boss__meta">
                {down}% down
                {p && p.due > 0 && ` · ${money(p.due)} this cycle`}
                {p && p.rolledIn > 0 && ` (${money(p.rolledIn)} rolled in)`}
              </div>
            </section>
          );
        })}
        {defeated.map((d) => (
          <section key={d.id} className="card boss is-defeated">
            <span className="boss__tag">DEFEATED</span>
            <div className="boss__row">
              <strong>💀 {d.name}</strong>
              <strong>{money(0)} HP</strong>
            </div>
            <div className="hp" aria-hidden="true">
              <div className="hp__fill is-defeated" style={{ width: "100%" }} />
            </div>
            {target && d.plan === "installments" && d.perCycle ? (
              <div className="boss__meta">
                {money(d.perCycle)}/cycle rolled into {target.name}
              </div>
            ) : null}
          </section>
        ))}
      </div>
      <Link to="/" className="link-btn">
        ← Back to Today
      </Link>
    </div>
  );
}

/** A sinking fund's pot. Always light: funds cut across phases. */
export function FundDetail({ id }: { id: string }) {
  const { data: b } = useQuery(budgetQuery);
  const { data: t } = useQuery(todayQuery);
  const fund = b?.budget.sinkingFunds.find((f) => f.id === id);
  if (!b || !t) return null;
  if (!fund)
    return (
      <div className="card">
        <p>That fund isn't here any more.</p>
        <Link to="/" className="link-btn">
          ← Back to Today
        </Link>
      </div>
    );
  const money = (n: number) => formatMoney(n, t.currency);
  const setAside = t.snapshot?.plan.sinking.find((f) => f.id === id)?.setAside ?? 0;
  const today = t.snapshot?.today.date ?? fund.dueDate;
  const monthsLeft = Math.max(0, Math.ceil(daysBetween(today, fund.dueDate) / 30.44));
  const pct = fund.target > 0 ? Math.min(100, Math.round((fund.saved / fund.target) * 100)) : 0;
  const onTrack = fund.saved + setAside * Math.max(monthsLeft, 1) >= fund.target;
  const due = new Date(`${fund.dueDate}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="fund">
      <BackButton />
      <h1>🪣 {fund.name} fund</h1>
      <div
        className="fund__pot"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${pct}% saved`}
      >
        <div style={{ height: `${pct}%` }} />
      </div>
      <div className="fund__hero">
        <div className="fund__amount">{money(fund.saved)}</div>
        <div className="fund__of">
          of {money(fund.target)} · due {due}
        </div>
      </div>
      <span className={`fund__chip ${onTrack ? "is-ok" : "is-behind"}`}>
        {onTrack ? "On track ✅" : "Falling behind ⚠️"}
      </span>
      <section className="card fund__rows">
        <div>
          <span>Set aside each cycle</span>
          <strong>{money(setAside)}</strong>
        </div>
        <div>
          <span>Months left</span>
          <strong>{monthsLeft}</strong>
        </div>
      </section>
      <Link to="/" className="link-btn">
        ← Back to Today
      </Link>
    </div>
  );
}

/** The end-of-week choice: last week's leftover to the target debt, or to savings. */
export function SweepOffer() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery(todayQuery);
  const choose = useMutation({
    mutationFn: ({ week, debtId }: { week: number; debtId: string | null }) =>
      api<TodayData>(`/cycles/current/sweeps/${week}`, { method: "PUT", json: { debtId } }),
    onSuccess: (today) => {
      qc.setQueryData(todayQuery.queryKey, today);
      qc.invalidateQueries({ queryKey: ["budget"] });
      navigate({ to: "/" });
    },
  });
  const offer = data?.sweepOffer;
  if (!data || !offer) return null;
  const money = formatMoney(offer.amount, data.currency);
  const line = say("sweep.offer", data.prefs.personality, { name: offer.target.name }, { stakes: data.stakes });

  return (
    <div className="sweep">
      <div className="label">Left over from last week</div>
      <div className="sweep__amount">{money}</div>
      <p>{line}</p>
      <div className="sweep__options">
        <button
          className="sweep__option is-attack"
          disabled={choose.isPending}
          onClick={() => choose.mutate({ week: offer.week, debtId: offer.target.id })}
        >
          <span className="sweep__option-emoji">⚔️</span>
          <strong>Attack {offer.target.name}</strong>
          <span className="sweep__option-sub">{money} off the target</span>
        </button>
        <button
          className="sweep__option is-save"
          disabled={choose.isPending}
          onClick={() => choose.mutate({ week: offer.week, debtId: null })}
        >
          <span className="sweep__option-emoji">{offer.goal?.emoji ?? "🌱"}</span>
          <strong>Save it</strong>
          <span className="sweep__option-sub">{offer.goal ? `Into ${offer.goal.name}` : "Into savings"}</span>
        </button>
      </div>
      {choose.isError && <p role="alert">That didn't go through. Try again?</p>}
      <button
        className="link-btn sweep__later"
        onClick={() => {
          postponeSweep(data);
          navigate({ to: "/" });
        }}
      >
        Decide later
      </button>
    </div>
  );
}

const CHANGES: Record<Phase, string[]> = {
  stabilise: ["Minimums and bills come first", "Your rent fund gets fed every cycle"],
  attack: [
    "Extra money goes to the most expensive debt first",
    "A cleared debt's payment rolls onto the next one",
    "Weekly leftovers can go straight at the target",
  ],
  build: ["Savings go to your goals", "Today tracks your savings rate", "No more boss fights"],
};

const CONFETTI = ["#ef4444", "#f97316", "#22c55e", "#0ea5a0", "#818cf8", "#facc15"];

/** The once-per-advance celebration; the CTA clears it server-side. */
export function PhaseUp() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery(todayQuery);
  const done = useMutation({
    mutationFn: () => api<void>("/phase/celebrated", { method: "POST" }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: todayQuery.queryKey });
      navigate({ to: "/" });
    },
  });
  const pieces = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        background: CONFETTI[i % CONFETTI.length],
        animationDelay: `${((i * 0.29) % 3).toFixed(2)}s`,
      })),
    [],
  );
  const c = data?.phase?.celebrate;
  if (!data || !c) return null;
  const from = PHASES.find((p) => p.key === c.from)!;
  const to = PHASES.find((p) => p.key === c.to)!;
  const line =
    c.to === "stabilise" ? to.meaning : say(`phaseup.${c.to}`, data.prefs.personality, {}, { stakes: data.stakes });

  return (
    <div className="phaseup" data-phase={c.to}>
      <div className="phaseup__confetti" aria-hidden="true">
        {pieces.map((s, i) => (
          <span key={i} style={s} />
        ))}
      </div>
      <div className="phaseup__badge" aria-hidden="true">
        <span>{to.emoji}</span>
      </div>
      <div className="phaseup__from">{from.label.toUpperCase()} COMPLETE</div>
      <h1>{to.label} unlocked</h1>
      <p className="phaseup__line">{line}</p>
      <section className="card phaseup__changes">
        <h2>What changes</h2>
        <ul>
          {CHANGES[c.to].map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </section>
      <button className="btn" disabled={done.isPending} onClick={() => done.mutate()}>
        Let's go {to.emoji}
      </button>
      <button
        className="back-btn back-btn--corner phaseup__close"
        aria-label="Close"
        disabled={done.isPending}
        onClick={() => done.mutate()}
      >
        ✕
      </button>
    </div>
  );
}
