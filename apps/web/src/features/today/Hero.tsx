import { formatMoney, type OpenCycle, PHASES, type Tone } from "@coinfidant/engine";
import { Shuffle } from "lucide-react";
import { useEffect, useState } from "react";
import { Sticker } from "@/components/ui/sticker";
import type { Budget } from "@/lib/budget";
import type { TodayData } from "@/lib/today";
import { cn } from "@/lib/utils";
import { fill, TODAY_COPY } from "./copy";

type Kind = "stabilise" | "attack" | "build" | "discovery";

const pct = (n: number, of: number) => (of > 0 ? Math.max(0, Math.min(100, (n / of) * 100)) : 0);
const ratePct = (bp: number) => `${Math.round(bp / 100)}%`;

/** The headline card. Its number depends on the phase; safe-to-spend stays visible in every one. */
export function Hero({
  data,
  snapshot: s,
  budget,
  kind,
  tone,
  quips,
}: {
  data: TodayData;
  snapshot: OpenCycle;
  budget: Budget | undefined;
  kind: Kind;
  tone: Tone;
  quips: string[];
}) {
  const money = (n: number) => formatMoney(n, data.currency);
  const copy = TODAY_COPY.hero[kind];
  const safe = Math.max(0, s.today.spendToday);
  const week = s.today.week;
  const emoji = kind === "discovery" ? "🔍" : PHASES.find((p) => p.key === kind)!.emoji;

  let value: string;
  let sub: string;
  let bar: { label: string; value: string; of?: string; fill: number };

  if (kind === "attack") {
    const rolled = s.plan.debts.reduce((a, d) => a + d.rolledIn, 0);
    const firepower = rolled + s.savings.sweptToDebts.reduce((a, d) => a + d.amount, 0);
    const debts = budget?.debts ?? [];
    const original = debts.reduce((a, d) => a + Math.max(d.originalAmount, d.amountLeft), 0);
    const cleared = debts.reduce((a, d) => a + Math.max(0, Math.max(d.originalAmount, d.amountLeft) - d.amountLeft), 0);
    value = money(firepower);
    sub = [
      firepower > 0
        ? rolled > 0
          ? fill(TODAY_COPY.freed[tone], { amount: money(rolled) })
          : ""
        : TODAY_COPY.noFirepower[tone],
      fill(TODAY_COPY.safeToSpend, { amount: money(safe) }),
    ]
      .filter(Boolean)
      .join(" ");
    bar = {
      label: "Total debt cleared",
      value: money(cleared),
      of: `of ${money(original)}`,
      fill: pct(cleared, original),
    };
  } else if (kind === "build") {
    const rateBp = s.plan.salary > 0 ? Math.round((s.savings.net / s.plan.salary) * 10_000) : 0;
    // A stretch to aim at: 50%, or the next ten once that's passed.
    const stretch = rateBp < 5000 ? 50 : Math.ceil((rateBp + 1) / 1000) * 10;
    const last = data.lastRateBp;
    value = ratePct(rateBp);
    sub = [
      last === null
        ? ""
        : fill(
            Math.round(last / 100) === Math.round(rateBp / 100)
              ? TODAY_COPY.rateSame
              : rateBp > last
                ? TODAY_COPY.rateUp
                : TODAY_COPY.rateDown,
            {
              rate: ratePct(last),
            },
          ),
      fill(TODAY_COPY.safeToSpend, { amount: money(safe) }),
    ]
      .filter(Boolean)
      .join(" ");
    const goal = Math.round((s.plan.salary * stretch) / 100);
    bar = {
      label: "Saved this cycle",
      value: money(s.savings.net),
      of: `toward a ${stretch}% stretch`,
      fill: pct(s.savings.net, goal),
    };
  } else {
    const usual = week.days > 0 ? Math.floor(week.budget / week.days) : 0;
    const carried = s.today.dailyPace - usual;
    value = money(safe);
    sub =
      carried >= 100_00
        ? fill(TODAY_COPY.rollover[tone], { amount: money(carried) })
        : carried <= -100_00
          ? fill(TODAY_COPY.rolloverDown[tone], { amount: money(-carried) })
          : "";
    bar = {
      label: "Left this week",
      value: money(Math.max(0, s.today.leftThisWeek)),
      of: `of ${money(week.budget)}`,
      fill: pct(s.today.leftThisWeek, week.budget),
    };
  }

  return (
    <section
      className="relative isolate overflow-hidden rounded-[28px] bg-primary p-6 text-primary-foreground min-[900px]:p-9"
      aria-label={copy.label}
    >
      <Rings />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-bold tracking-[0.2em] uppercase opacity-80">{copy.label}</span>
            <Sticker variant="ink" tilt="right">
              {copy.sticker[tone]}
            </Sticker>
          </div>
          <div className="mt-3 font-heading text-[clamp(44px,9vw,84px)] leading-[0.95] font-extrabold tracking-[-0.03em]">
            {value}
          </div>
          {sub && <p className="mt-4 max-w-xl text-[15px] font-medium opacity-85">{sub}</p>}
        </div>
        <div
          aria-hidden="true"
          className="hidden size-24 shrink-0 place-items-center rounded-3xl border-2 border-[var(--accent-ink)]/15 bg-[var(--accent-ink)]/10 text-5xl min-[560px]:grid"
        >
          {emoji}
        </div>
      </div>

      <QuipBar lines={quips} />

      <div className="mt-6">
        <div className="flex items-baseline justify-between gap-3 text-[15px] font-medium">
          <span className="opacity-85">{bar.label}</span>
          <span>
            <strong className="font-bold">{bar.value}</strong>
            {bar.of && <span className="opacity-70"> {bar.of}</span>}
          </span>
        </div>
        <div
          className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-[var(--accent-ink)]/15"
          role="progressbar"
          aria-valuenow={Math.round(bar.fill)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={bar.label}
        >
          <div
            className="h-full rounded-full bg-[var(--accent-ink)] transition-[width] duration-700"
            style={{ width: `${bar.fill}%` }}
          />
        </div>
      </div>
    </section>
  );
}

function Rings() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute -top-28 -right-24 size-[380px] rounded-full border-[48px] border-[var(--accent-ink)]/[0.06]" />
      <div className="absolute -bottom-40 left-1/3 size-[260px] rounded-full border-[36px] border-[var(--accent-ink)]/[0.05]" />
    </div>
  );
}

/** One line at a time; rotates on its own, or on demand with the shuffle button. */
function QuipBar({ lines }: { lines: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (lines.length < 2) return;
    const id = setInterval(() => setI((n) => n + 1), 9000);
    return () => clearInterval(id);
  }, [lines]);
  const line = lines[i % Math.max(1, lines.length)];
  if (!line) return null;
  return (
    <div className="mt-6 flex items-center gap-4 rounded-2xl bg-[var(--accent-ink)] px-5 py-4 text-[var(--accent)]">
      <p
        key={i}
        className={cn("m-0 flex-1 text-[15px] font-semibold", "animate-in fade-in-0 duration-500")}
        aria-live="polite"
      >
        {line}
      </p>
      {lines.length > 1 && (
        <button
          type="button"
          onClick={() => setI((n) => n + 1)}
          aria-label="Another line"
          className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-[var(--accent)] text-[var(--accent-ink)] transition-transform active:scale-90"
        >
          <Shuffle className="size-[18px]" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
