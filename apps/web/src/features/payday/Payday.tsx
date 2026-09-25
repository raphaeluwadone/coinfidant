import { formatMoney, type Minor } from "@coinfidant/engine";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { type Budget, budgetQuery } from "../../lib/budget";
import { billEmoji, creditorEmoji } from "../../lib/emoji";
import { todayQuery, type TodayData } from "../../lib/today";
import { markPaydaySeen, setTopUp } from "../../lib/transactions";
import "./Flow.css";

type Row = {
  key: string;
  label: string;
  amount: Minor;
  topUp?: { id: string; offer: Minor; accepted: Minor };
};

/** Bills, then set-asides, debt minimums and supported people: the priority order from onboarding. */
export function feedRows(data: TodayData, budget: Budget): Row[] {
  const s = data.snapshot!;
  const offer = (id: string) => {
    const hit = s.suggestions.find((x) => x.kind === "idealTopUp" && x.id === id);
    return hit?.kind === "idealTopUp" ? hit.amount : 0;
  };
  const accepted = (id: string) => data.topUps?.find((t) => t.id === id)?.amount ?? 0;
  const withTopUp = (id: string) => {
    const o = offer(id);
    const a = accepted(id);
    return o > 0 || a > 0 ? { topUp: { id, offer: o, accepted: a } } : {};
  };

  const rows: Row[] = budget.bills.map((b, i) => ({
    key: b.id ?? `b${i}`,
    label: `${billEmoji(b.name)} ${b.name}`,
    amount: b.amount,
  }));

  for (const f of s.plan.sinking) {
    const fund = budget.sinkingFunds.find((x) => x.id === f.id);
    if (!fund || f.setAside <= 0) continue;
    rows.push({ key: f.id, label: `${/rent/i.test(fund.name) ? "🏠" : "🪣"} ${fund.name} fund`, amount: f.setAside });
  }
  for (const d of s.plan.debts) {
    const debt = budget.debts.find((x) => x.id === d.id);
    if (!debt || d.due <= 0) continue;
    const label = debt.plan === "oneOff" ? debt.name : `${debt.name} minimum`;
    rows.push({ key: d.id, label: `${creditorEmoji(debt.creditor)} ${label}`, amount: d.due, ...withTopUp(d.id) });
  }
  for (const c of s.plan.commitments) {
    const person = budget.commitments.find((x) => x.id === c.id);
    if (!person || c.amount <= 0) continue;
    const atIdeal = c.amount >= person.idealAmount && person.idealAmount > person.minAmount;
    rows.push({
      key: c.id,
      label: `👤 ${person.name}${atIdeal ? " (ideal)" : ""}`,
      amount: c.amount,
      ...withTopUp(c.id),
    });
  }
  return rows;
}

export function Payday() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery(todayQuery);
  const { data: budgetData } = useQuery(budgetQuery);
  const [step, setStep] = useState(1);

  const finish = useMutation({
    mutationFn: markPaydaySeen,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: todayQuery.queryKey });
      navigate({ to: "/" });
    },
  });

  const topUp = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: Minor }) => setTopUp(id, amount),
    onSuccess: (res) => qc.setQueryData(todayQuery.queryKey, res),
  });

  if (!data?.snapshot || !data.cycle || !budgetData) return <main className="flow" aria-busy="true" />;
  const s = data.snapshot;
  const cur = data.currency;

  if (step === 1)
    return (
      <main className="flow flow--center">
        <div className="flow__emoji is-floating" aria-hidden="true">
          💸
        </div>
        <h1 className="flow__title flow__title--xl">Salary landed!</h1>
        <p className="flow__lead">Before we get excited, let's feed the responsibilities first 🍽️</p>
        <span className="flow__tag">{formatMoney(data.cycle.salary, cur)} received</span>
        <div className="flow__spacer" />
        <button className="btn flow__cta" onClick={() => setStep(2)} autoFocus>
          Feed the responsibilities
        </button>
      </main>
    );

  if (step === 2) {
    const rows = feedRows(data, budgetData.budget);
    const total = rows.reduce((a, r) => a + r.amount, 0);
    return (
      <main className="flow">
        <h1 className="flow__title">Feeding the responsibilities</h1>
        <p className="flow__sub">One by one, before anything else touches this money.</p>
        <ul className="feed">
          {rows.length === 0 && <li className="feed__empty">Nothing fixed to feed this cycle. Lucky you.</li>}
          {rows.map((r, i) => (
            <li key={r.key} className="feed__row" style={{ animationDelay: `${0.1 + i * 0.15}s` }}>
              <span className="feed__check" style={{ animationDelay: `${0.1 + i * 0.15}s` }} aria-hidden="true">
                ✓
              </span>
              <span className="feed__label">{r.label}</span>
              <span className="feed__amount">{formatMoney(r.amount, cur)}</span>
              {r.topUp && (
                <div className="feed__topup">
                  {r.topUp.offer > 0 && (
                    <button
                      className="feed__topup-btn"
                      disabled={topUp.isPending}
                      onClick={() => topUp.mutate({ id: r.topUp!.id, amount: r.topUp!.accepted + r.topUp!.offer })}
                    >
                      Top up to ideal +{formatMoney(r.topUp.offer, cur)}
                    </button>
                  )}
                  {r.topUp.accepted > 0 && (
                    <button
                      className="feed__topup-undo"
                      disabled={topUp.isPending}
                      onClick={() => topUp.mutate({ id: r.topUp!.id, amount: 0 })}
                    >
                      Undo top-up
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="flow__total">
          <div className="flow__total-label">Total fed</div>
          <div className="flow__total-amount">{formatMoney(total, cur)}</div>
        </div>
        <button className="btn flow__cta" onClick={() => setStep(3)}>
          Reveal what's left
        </button>
      </main>
    );
  }

  return (
    <main className="flow flow--center">
      <div className="flow__emoji is-pop" aria-hidden="true">
        🎉
      </div>
      <h1 className="flow__title">Responsibilities fed. This is yours.</h1>
      <section className="flow__hero">
        <div className="flow__hero-label">Safe to spend</div>
        <div className="flow__hero-amount">
          {formatMoney(Math.max(0, s.today.dailyPace), cur)}
          <span>/day</span>
        </div>
        <span className="flow__hero-week">{formatMoney(s.today.week.budget, cur)} this week</span>
      </section>
      <div className="flow__spacer" />
      <button className="btn flow__cta" onClick={() => finish.mutate()} disabled={finish.isPending}>
        Let's go 😏
      </button>
    </main>
  );
}
