import { addMonths, attackOrder, formatMoney, insightText, say, type Tone } from "@coinfidant/engine";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, House, PiggyBank, ShieldCheck, Skull } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sticker } from "@/components/ui/sticker";
import { api } from "@/lib/api";
import type { Budget } from "@/lib/budget";
import { billEmoji, creditorEmoji } from "@/lib/emoji";
import { markInsightsSeen, todayQuery, type TodayData } from "@/lib/today";
import { cn } from "@/lib/utils";
import { Panel } from "../today/Cards";
import { fill, TODAY_COPY } from "../today/copy";

type Props = { data: TodayData; budget: Budget; tone: Tone };
const moneyOf = (data: TodayData) => (n: number) => formatMoney(n, data.currency);
const pct = (n: number, of: number) => (of > 0 ? Math.max(0, Math.min(100, Math.round((n / of) * 100))) : 0);

export const hpPercent = (left: number, original: number) =>
  original > 0 ? Math.max(0, Math.min(100, Math.round(((original - left) / original) * 100))) : 0;

/** The phase's line, rotated in with the day's quips. */
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
  useEffect(() => {
    markInsightsSeen(data.insights.map((x) => x.key));
  }, [data.insights]);
  if (!data.insights.length) return null;
  return (
    <Panel title="Worth knowing">
      <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-2.5 p-0">
        {data.insights.map((x) => (
          <li
            key={x.key}
            className={cn(
              "flex gap-3 rounded-2xl bg-secondary px-4 py-3 text-[15px] leading-snug",
              x.severity === "warn" && "shadow-[inset_3px_0_0_var(--warn)]",
              x.severity === "good" && "shadow-[inset_3px_0_0_var(--success)]",
            )}
          >
            <span aria-hidden="true">{x.emoji}</span>
            <span>{insightText(x, tone, moneyOf(data), { stakes: data.stakes })}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Bar({ value, className, fillClass }: { value: number; className?: string; fillClass?: string }) {
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-secondary", className)} aria-hidden="true">
      <div
        className={cn("h-full rounded-full bg-primary transition-[width] duration-700", fillClass)}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

/** The HP bar: a striped, outlined bar that empties as the debt is paid. */
export function HpBar({ left, label }: { left: number; label: string }) {
  return (
    <div
      className="h-3.5 overflow-hidden rounded-full border-2 border-foreground/80 p-0.5"
      role="progressbar"
      aria-valuenow={Math.round(left)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className="h-full rounded-full bg-[repeating-linear-gradient(90deg,var(--accent)_0_6px,transparent_6px_8px)] transition-[width] duration-700"
        style={{ width: `${Math.max(2, left)}%` }}
      />
    </div>
  );
}

type CheckRow = {
  key: string;
  label: string;
  amount: number;
  done: boolean;
  status: string;
  payId?: string;
  payAmount?: number;
};

/** Stabilise: every commitment this cycle, fed first. */
export function Checklist({ data, budget, tone }: Props) {
  const qc = useQueryClient();
  const s = data.snapshot!;
  const money = moneyOf(data);
  const pay = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      api(`/debts/${id}/payments`, { method: "POST", json: { amount } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: todayQuery.queryKey }),
  });
  const fed = tone === "gentle" ? "Set aside" : "Fed";
  const paid = (id: string) => data.debtPayments.filter((p) => p.debtId === id).reduce((a, p) => a + p.amount, 0);
  const rows: CheckRow[] = [
    ...budget.bills.map((x) => ({
      key: `b${x.id}`,
      label: `${billEmoji(x.name)} ${x.name}`,
      amount: x.amount,
      done: true,
      status: fed,
    })),
    ...s.plan.sinking
      .filter((f) => f.setAside > 0)
      .map((f) => ({
        key: f.id,
        label: `🪣 ${budget.sinkingFunds.find((x) => x.id === f.id)?.name ?? "Fund"} fund`,
        amount: f.setAside,
        done: true,
        status: fed,
      })),
    ...s.plan.debts
      .filter((d) => d.due > 0)
      .map((d) => {
        const debt = budget.debts.find((x) => x.id === d.id);
        const left = d.due - paid(d.id);
        return {
          key: d.id,
          label: `${creditorEmoji(debt?.creditor ?? "")} ${debt?.name ?? "Debt"} minimum`,
          amount: d.due,
          done: left <= 0,
          status: "Paid",
          payId: left > 0 ? d.id : undefined,
          payAmount: left,
        };
      }),
    ...s.plan.commitments
      .filter((c) => c.amount > 0)
      .map((c) => ({
        key: c.id,
        label: `👤 ${budget.commitments.find((x) => x.id === c.id)?.name ?? "Someone"}`,
        amount: c.amount,
        done: true,
        status: fed,
      })),
  ];
  const done = rows.filter((r) => r.done).length;
  return (
    <Panel
      title={TODAY_COPY.checklist.title[tone]}
      aside={<span className="font-heading text-lg font-bold text-foreground">{`${done}/${rows.length}`}</span>}
      sub={TODAY_COPY.checklist.sub[tone]}
    >
      {rows.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">Nothing fixed this cycle.</p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] p-0">
          {rows.map((r) => (
            <li
              key={r.key}
              className="flex items-center gap-3.5 border-t border-border py-3.5 first:border-t-0 first:pt-0"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full",
                  r.done ? "bg-primary text-primary-foreground" : "border-2 border-border",
                )}
              >
                {r.done && <Check className="size-4" strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate text-[15px] font-semibold",
                    r.done && "text-muted-foreground line-through",
                  )}
                >
                  {r.label}
                </span>
                <span className="block text-[13px] text-muted-foreground">{r.done ? r.status : "Due"}</span>
              </span>
              {r.payId ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled={pay.isPending}
                  onClick={() => pay.mutate({ id: r.payId!, amount: r.payAmount! })}
                >
                  Mark paid
                </Button>
              ) : null}
              <span className="font-heading text-[15px] font-bold">{money(r.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

const dueLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });

/** Stabilise: sinking funds as progress cards. */
export function SafetyNets({ data, budget, tone }: Props) {
  if (!budget.sinkingFunds.length) return null;
  const money = moneyOf(data);
  return (
    <section className="grid gap-4">
      <div>
        <h2 className="m-0 text-xl">{TODAY_COPY.safetyNets.title[tone]}</h2>
        <p className="m-0 mt-1.5 text-[15px] text-muted-foreground">{TODAY_COPY.safetyNets.sub[tone]}</p>
      </div>
      <div className="grid gap-4 min-[640px]:grid-cols-2">
        {budget.sinkingFunds.map((f) => {
          const p = pct(f.saved, f.target);
          const Icon = !f.dueDate ? ShieldCheck : /rent|house/i.test(f.name) ? House : PiggyBank;
          return (
            <Card asChild key={f.id} className="grid gap-4 p-6 transition-colors hover:bg-secondary">
              <Link to="/funds/$id" params={{ id: f.id }} className="text-foreground">
                <span className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2.5 text-[15px] font-semibold">
                    <span className="grid size-9 place-items-center rounded-full bg-accent text-accent-foreground">
                      <Icon className="size-[18px]" aria-hidden="true" />
                    </span>
                    {f.name}
                  </span>
                  <span className="font-heading text-3xl font-extrabold">{p}%</span>
                </span>
                <Bar value={p} />
                <span className="flex justify-between gap-3 text-[13px] text-muted-foreground">
                  <span>
                    <strong className="font-bold text-foreground">{money(f.saved)}</strong> / {money(f.target)}
                  </span>
                  <span>{f.dueDate ? `Due ${dueLabel(f.dueDate)}` : "No deadline"}</span>
                </span>
              </Link>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

const aprText = (bp: number | null | undefined) => (bp ? `${bp / 100}% APR` : null);

/** Attack: the current boss. */
export function TargetCard({ data, budget, tone }: Props) {
  const t = data.target;
  if (!t) return null;
  const money = moneyOf(data);
  const debt = budget.debts.find((d) => d.id === t.id);
  const plan = data.snapshot!.plan.debts.find((d) => d.id === t.id);
  const swept = data.snapshot!.savings.sweptToDebts.filter((d) => d.debtId === t.id).reduce((a, d) => a + d.amount, 0);
  const minimum = plan ? plan.due - plan.rolledIn : 0;
  const extra = (plan?.rolledIn ?? 0) + swept;
  const original = Math.max(t.originalAmount, t.amountLeft);
  const left = original > 0 ? (t.amountLeft / original) * 100 : 100;
  return (
    <Card asChild className="relative mt-4 grid gap-4 border-2 border-primary p-6">
      <section aria-label={`Current target: ${t.name}`}>
        <Sticker className="absolute -top-3.5 left-5">🎯 {TODAY_COPY.target.sticker[tone]}</Sticker>
        <div className="flex items-start justify-between gap-3 pt-1">
          <div>
            <h2 className="m-0 text-2xl">{t.name}</h2>
            <p className="m-0 mt-1 text-[15px] text-muted-foreground">{TODAY_COPY.target.sub[tone]}</p>
          </div>
          {aprText(debt?.aprBp) && (
            <span className="rounded-lg bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground">
              {aprText(debt?.aprBp)}
            </span>
          )}
        </div>
        <div className="grid gap-2">
          <div className="flex justify-between text-[15px]">
            <span className="font-semibold text-muted-foreground">HP</span>
            <span>
              <strong className="font-bold">{money(t.amountLeft)}</strong>
              <span className="text-muted-foreground"> / {money(original)}</span>
            </span>
          </div>
          <HpBar left={left} label={`${Math.round(left)}% of ${t.name} left`} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-secondary px-4 py-3">
            <div className="text-[13px] text-muted-foreground">Minimum</div>
            <div className="font-heading text-lg font-bold">{money(Math.max(0, minimum))}</div>
          </div>
          <div className="rounded-2xl bg-accent px-4 py-3">
            <div className="text-[13px] text-muted-foreground">Extra hit this month</div>
            <div className="font-heading text-lg font-bold">{money(extra)}</div>
          </div>
        </div>
        <Button asChild variant="link" size="inline">
          <Link to="/debts">Debt board →</Link>
        </Button>
      </section>
    </Card>
  );
}

/** Attack: everything queued behind the target, then the defeated. */
export function HitList({ data, budget, tone }: Props) {
  const money = moneyOf(data);
  const order = attackOrder(budget.debts);
  const queued = order.slice(1);
  const defeated = budget.debts.filter((d) => d.amountLeft <= 0);
  if (!queued.length && !defeated.length) return null;
  const due = (id: string) => data.snapshot!.plan.debts.find((d) => d.id === id)?.due ?? 0;
  return (
    <Panel title={TODAY_COPY.hitList.title[tone]} sub={TODAY_COPY.hitList.sub[tone]}>
      <ol className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-3 p-0">
        {queued.map((d, i) => {
          const original = Math.max(d.originalAmount, d.amountLeft);
          return (
            <li key={d.id} className="grid gap-2.5 rounded-2xl border border-border px-4 py-3.5">
              <div className="flex items-center gap-3">
                <span className="grid size-7 place-items-center rounded-full bg-secondary text-xs font-bold">
                  {i + 2}
                </span>
                <span className="flex-1 truncate text-[15px] font-semibold">
                  {creditorEmoji(d.creditor)} {d.name}
                </span>
                <span className="font-heading text-[15px] font-bold">{money(d.amountLeft)}</span>
              </div>
              <HpBar left={original > 0 ? (d.amountLeft / original) * 100 : 100} label={`${d.name} left`} />
              <div className="text-[13px] text-muted-foreground">
                {[
                  aprText(d.aprBp) ?? (d.hasInterest ? "Charges interest" : "No interest"),
                  `minimum ${money(due(d.id))}`,
                ].join(" · ")}
              </div>
            </li>
          );
        })}
        {defeated.map((d) => (
          <li
            key={d.id}
            className="flex items-center gap-3 rounded-2xl border border-dashed border-border px-4 py-3.5 opacity-60"
          >
            <Skull className="size-5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold line-through">{d.name}</span>
              {data.target && d.plan === "installments" && d.perCycle ? (
                <span className="block text-[13px] text-muted-foreground">
                  {fill(TODAY_COPY.hitList.rolled, { amount: money(d.perCycle), name: data.target.name })}
                </span>
              ) : null}
            </span>
            <span className="font-heading text-sm font-bold">KO</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

const monthYear = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", month: "short", year: "numeric" });

/** Build: goals as cards, with a rough finish date at this cycle's savings pace. */
export function GoalsGrid({ data, budget, tone }: Props) {
  if (!budget.goals.length) return null;
  const s = data.snapshot!;
  const money = moneyOf(data);
  // Until savings are split across goals, assume each gets an equal share of the planned savings.
  const share = budget.goals.length ? s.savings.planned / budget.goals.length : 0;
  return (
    <section className="grid gap-4">
      <div>
        <h2 className="m-0 text-xl">{TODAY_COPY.goals.title[tone]}</h2>
        <p className="m-0 mt-1.5 text-[15px] text-muted-foreground">{TODAY_COPY.goals.sub[tone]}</p>
      </div>
      <div className="grid gap-4 min-[640px]:grid-cols-2 min-[1200px]:grid-cols-3">
        {budget.goals.map((g) => {
          const p = pct(g.saved, g.target);
          const months = share > 0 ? Math.ceil(Math.max(0, g.target - g.saved) / share) : null;
          return (
            <Card key={g.id} className="relative grid gap-3 p-6">
              {p >= 50 && p < 100 && (
                <Sticker tilt="right" className="absolute -top-3 right-4">
                  {TODAY_COPY.goals.halfway[tone]}
                </Sticker>
              )}
              <span aria-hidden="true" className="text-3xl">
                {g.emoji}
              </span>
              <span className="text-[17px] font-semibold">{g.name}</span>
              <span className="font-heading text-4xl font-extrabold">{p}%</span>
              <Bar value={p} />
              <span className="text-[13px] leading-relaxed text-muted-foreground">
                <strong className="font-bold text-foreground">{money(g.saved)}</strong> / {money(g.target)}
                <br />
                {p >= 100
                  ? "Done 🎉"
                  : months !== null
                    ? `Projected ${monthYear(addMonths(s.today.date, months))}`
                    : "Add savings to see a date"}
              </span>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

/** Build: the people you support, minimum against ideal. */
export function People({ data, budget, tone }: Props) {
  const s = data.snapshot!;
  if (!budget.commitments.length) return null;
  const money = moneyOf(data);
  return (
    <Panel title={TODAY_COPY.people.title[tone]} sub={TODAY_COPY.people.sub[tone]}>
      <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-5 p-0">
        {budget.commitments.map((c) => {
          const amount = s.plan.commitments.find((x) => x.id === c.id)?.amount ?? c.minAmount;
          const ideal = Math.max(c.idealAmount, c.minAmount, 1);
          return (
            <li key={c.id} className="grid gap-2">
              <div className="flex justify-between gap-3 text-[15px]">
                <span className="font-semibold">❤️ {c.name}</span>
                <span className="font-heading font-bold">{money(amount)}</span>
              </div>
              <div className="relative">
                <Bar value={pct(amount, ideal)} fillClass="bg-success" />
                <span
                  aria-hidden="true"
                  className="absolute top-0 h-2 w-0.5 bg-foreground/70"
                  style={{ left: `${pct(c.minAmount, ideal)}%` }}
                />
              </div>
              <span className="text-[13px] text-muted-foreground">
                {amount >= c.idealAmount
                  ? "Ideal amount reached"
                  : `Minimum ${money(c.minAmount)} covered · ideal ${money(c.idealAmount)}`}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
