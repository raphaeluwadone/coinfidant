import { attackOrder, formatMoney, type Phase, PHASES, say, sinkingCyclesLeft } from "@coinfidant/engine";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { BackButton } from "../../components/BackButton";
import { api } from "../../lib/api";
import { budgetQuery } from "../../lib/budget";
import { creditorEmoji } from "../../lib/emoji";
import { postponeSweep, todayQuery, type TodayData } from "../../lib/today";
import { HpBar, hpPercent } from "./PhaseParts";
import "./Phases.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";

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
      <PageHeader
        eyebrow="Debts"
        title="Debt board ⚔️"
        sub={`Most expensive dies first.${extra > 0 ? ` Extra ${money(extra)}/cycle.` : ""}`}
      />
      {debts.length === 0 && (
        <Card asChild>
          <p>No debts. Nothing to fight.</p>
        </Card>
      )}
      <div className="board__list">
        {active.map((d) => {
          const isTarget = d.id === target?.id;
          const p = planned(d.id);
          const down = hpPercent(d.amountLeft, d.originalAmount);
          return (
            <Card asChild key={d.id} className={`boss ${isTarget ? "is-target" : ""}`}>
              <section>
                <Badge variant="plain" className="justify-self-start text-[11px] tracking-[0.06em]">
                  {isTarget ? "🔥 CURRENT TARGET" : "QUEUED"}
                </Badge>
                <div className="boss__row">
                  <strong>
                    {creditorEmoji(d.creditor)} {d.name}
                  </strong>
                  <strong>{money(d.amountLeft)} HP</strong>
                </div>
                <HpBar left={100 - down} label={`${100 - down}% of ${d.name} left`} />
                <div className="boss__meta">
                  {down}% down
                  {p && p.due > 0 && ` · ${money(p.due)} this cycle`}
                  {p && p.rolledIn > 0 && ` (${money(p.rolledIn)} rolled in)`}
                </div>
              </section>
            </Card>
          );
        })}
        {defeated.map((d) => (
          <Card asChild key={d.id} className="boss is-defeated">
            <section>
              <Badge variant="plain" className="justify-self-start text-[11px] tracking-[0.06em] text-success">
                DEFEATED
              </Badge>
              <div className="boss__row">
                <strong>💀 {d.name}</strong>
                <strong>{money(0)} HP</strong>
              </div>
              <div className="h-3.5 rounded-full bg-success/70" aria-hidden="true" />
              {target && d.plan === "installments" && d.perCycle ? (
                <div className="boss__meta">
                  {money(d.perCycle)}/cycle rolled into {target.name}
                </div>
              ) : null}
            </section>
          </Card>
        ))}
      </div>
      <Button asChild variant="link" size="inline">
        <Link to="/">← Back to Today</Link>
      </Button>
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
      <Card>
        <p>That fund isn't here any more.</p>
        <Button asChild variant="link" size="inline">
          <Link to="/">← Back to Today</Link>
        </Button>
      </Card>
    );
  const money = (n: number) => formatMoney(n, t.currency);
  const setAside = t.snapshot?.plan.sinking.find((f) => f.id === id)?.setAside ?? 0;
  // Counted the way the engine spreads the set-aside, so a fund on plan never reads as behind.
  const cyclesLeft =
    t.cycle && fund.dueDate ? sinkingCyclesLeft(fund.dueDate, t.cycle.startDate, b.budget.expectedPayday) : null;
  const pct = fund.target > 0 ? Math.min(100, Math.round((fund.saved / fund.target) * 100)) : 0;
  // An open-ended buffer can't fall behind a deadline it doesn't have.
  const onTrack = cyclesLeft === null || fund.saved + setAside * cyclesLeft >= fund.target;
  const due = fund.dueDate
    ? new Date(`${fund.dueDate}T00:00:00Z`).toLocaleDateString("en-GB", {
        timeZone: "UTC",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

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
          of {money(fund.target)} · {due ? `due ${due}` : "no deadline"}
        </div>
      </div>
      <span className={`fund__chip ${onTrack ? "is-ok" : "is-behind"}`}>
        {onTrack ? "On track ✅" : "Falling behind ⚠️"}
      </span>
      <Card asChild className="fund__rows">
        <section>
          <div>
            <span>Set aside each cycle</span>
            <strong>{money(setAside)}</strong>
          </div>
          <div>
            <span>Paydays left</span>
            <strong>{cyclesLeft ?? "No deadline"}</strong>
          </div>
        </section>
      </Card>
      <Button asChild variant="link" size="inline">
        <Link to="/">← Back to Today</Link>
      </Button>
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
      <Eyebrow>Left over from last week</Eyebrow>
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
      <Button
        variant="muted"
        size="inline"
        className="justify-self-center"
        onClick={() => {
          postponeSweep(data);
          navigate({ to: "/" });
        }}
      >
        Decide later
      </Button>
    </div>
  );
}

const CHANGES: Record<Phase, string[]> = {
  stabilise: ["Minimums and bills come first", "Your big-bill funds get fed every cycle"],
  attack: [
    "Extra money now goes after your priciest debt",
    "Each cleared debt passes its payment to the next",
    "Weekly leftovers can go straight at the target",
  ],
  build: [
    "Money shifts from debts to your goals",
    "Savings rate becomes your headline number",
    "Support for your people moves toward the ideal amount",
  ],
};

const HEADLINE: Record<Phase, string> = {
  stabilise: "Stabilise mode on",
  attack: "Level up: Attack unlocked",
  build: "Debt-free. Build unlocked",
};

const SHORT: Record<Phase, string> = {
  stabilise: "Stop the bleeding",
  attack: "Hunt the debts down",
  build: "Grow the future",
};

/** The once-per-advance celebration, in the new phase's colour; the button clears it server-side. */
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
  const c = data?.phase?.celebrate;
  if (!data || !c) return null;
  const to = PHASES.find((p) => p.key === c.to)!;
  const line =
    c.to === "stabilise" ? null : say(`phaseup.${c.to}`, data.prefs.personality, {}, { stakes: data.stakes });
  const rise = "animate-in fade-in-0 slide-in-from-bottom-3 duration-500 [animation-fill-mode:both]";
  const after = (ms: number) => ({ animationDelay: `${ms}ms` });

  return (
    <main
      data-phase={c.to}
      className="relative grid min-h-dvh place-items-center bg-primary px-5 py-12 text-primary-foreground"
    >
      <Button
        variant="ghost"
        size="icon"
        aria-label="Close"
        disabled={done.isPending}
        onClick={() => done.mutate()}
        className="absolute top-[calc(16px+env(safe-area-inset-top,0px))] right-4 text-primary-foreground hover:bg-[var(--accent-ink)]/10"
      >
        <X className="size-5" aria-hidden="true" />
      </Button>
      <div className="grid w-full max-w-[560px] justify-items-center gap-5 text-center">
        <span className={`text-xs font-bold tracking-[0.3em] uppercase opacity-75 ${rise}`}>Level up</span>
        <span
          aria-hidden="true"
          className="grid size-36 animate-in place-items-center rounded-[32px] bg-[var(--accent-ink)]/10 zoom-in-50 duration-700"
        >
          <span className="grid size-24 place-items-center rounded-full border-2 border-[var(--accent-ink)]/25 text-6xl">
            {to.emoji}
          </span>
        </span>
        <h1
          className={`m-0 font-heading text-[clamp(38px,7vw,56px)] leading-[1.05] font-extrabold tracking-[-0.03em] ${rise}`}
          style={after(100)}
        >
          {HEADLINE[c.to]} {to.emoji}
        </h1>
        <p className={`m-0 -mt-2 text-lg font-medium opacity-80 ${rise}`} style={after(150)}>
          {SHORT[c.to]}
        </p>
        <ul className={`m-0 mt-2 grid w-full list-none gap-3 p-0 text-left ${rise}`} style={after(200)}>
          {CHANGES[c.to].map((x) => (
            <li
              key={x}
              className="flex items-center gap-3 rounded-2xl bg-[var(--accent-ink)]/10 px-4 py-3.5 text-[15px] font-semibold"
            >
              <Check className="size-4 shrink-0" strokeWidth={3} aria-hidden="true" />
              {x}
            </li>
          ))}
        </ul>
        {line && (
          <p className={`m-0 max-w-md text-sm opacity-75 ${rise}`} style={after(300)}>
            {line}
          </p>
        )}
        <button
          type="button"
          disabled={done.isPending}
          onClick={() => done.mutate()}
          className={`mt-2 h-14 w-full cursor-pointer rounded-2xl border-0 bg-[var(--accent-ink)] font-heading text-lg font-bold text-[var(--accent)] transition-transform active:scale-[0.98] disabled:opacity-60 ${rise}`}
          style={after(300)}
        >
          Let's go
        </button>
      </div>
    </main>
  );
}
