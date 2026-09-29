import { type DayCell, formatMoney, type Phase, PHASES, type Tone } from "@coinfidant/engine";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sticker } from "@/components/ui/sticker";
import { monthLabel } from "@/lib/dates";
import type { TodayData, TxnRow } from "@/lib/today";
import { cn } from "@/lib/utils";
import { fill, TODAY_COPY } from "./copy";

/** A titled card: heading, optional right-hand note, optional sub-line. */
export function Panel({
  title,
  aside,
  sub,
  children,
  className,
}: {
  title: string;
  aside?: ReactNode;
  sub?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card asChild className={cn("grid grid-cols-[minmax(0,1fr)] content-start gap-4 p-6", className)}>
      <section>
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="m-0 text-xl">{title}</h2>
            {aside && <div className="text-sm font-medium text-muted-foreground">{aside}</div>}
          </div>
          {sub && <p className="m-0 mt-1.5 text-[15px] text-muted-foreground">{sub}</p>}
        </div>
        {children}
      </section>
    </Card>
  );
}

const SHORT: Record<Phase, string> = {
  stabilise: "Stop the bleeding",
  attack: "Hunt the debts down",
  build: "Grow the future",
};

/** Stabilise → Attack → Build, with where you are and roughly when the next one unlocks. */
export function GlowUp({ phase, tone }: { phase: NonNullable<TodayData["phase"]>; tone: Tone }) {
  const at = PHASES.findIndex((p) => p.key === phase.phase);
  const aside =
    phase.phase === "build"
      ? TODAY_COPY.glowUp.build[tone]
      : phase.unlocksAround
        ? fill(TODAY_COPY.glowUp[phase.phase][tone], { month: monthLabel(phase.unlocksAround, "short") })
        : TODAY_COPY.glowUp.unknown[tone];
  return (
    <Panel title="Your glow-up" aside={aside}>
      <ol className="m-0 grid list-none grid-cols-[1fr_auto_1fr_auto_1fr] items-start p-0">
        {PHASES.map((p, i) => (
          <li key={p.key} className="contents">
            {i > 0 && (
              <span
                aria-hidden="true"
                className="mt-7 h-1 w-10 overflow-hidden rounded-full bg-secondary min-[1200px]:w-14"
              >
                <span
                  className={cn(
                    "block h-full rounded-full bg-primary",
                    i <= at ? "w-full" : i === at + 1 ? "w-1/3" : "w-0",
                  )}
                />
              </span>
            )}
            <div
              className={cn("grid justify-items-center gap-1 text-center", i > at && "opacity-45")}
              aria-current={i === at ? "step" : undefined}
            >
              <span
                className={cn(
                  "grid size-14 place-items-center rounded-full text-2xl",
                  i < at && "bg-foreground text-background",
                  i === at && "bg-primary text-primary-foreground ring-4 ring-primary/25",
                  i > at && "border border-border bg-secondary",
                )}
              >
                {i < at ? <Check className="size-6" strokeWidth={3} aria-hidden="true" /> : p.emoji}
              </span>
              <span
                className={cn("mt-1.5 font-heading text-[15px] font-bold", i === at ? "text-foreground" : "text-soft")}
              >
                {p.label}
              </span>
              <span className="max-w-[9ch] text-xs leading-snug text-muted-foreground">{SHORT[p.key]}</span>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

const DAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** One bar per day. Over-budget days go coral; the worst one gets a sticker, today gets "you are here". */
export function WeekChart({
  cells,
  usual,
  currency,
  tone,
}: {
  cells: DayCell[];
  usual: number;
  currency: TodayData["currency"];
  tone: Tone;
}) {
  const over = (c: DayCell) => c.state === "over" || c.state === "covered";
  const worst = cells.reduce<number | null>(
    (w, c, i) => (over(c) && (w === null || c.spent > cells[w]!.spent) ? i : w),
    null,
  );
  const top = Math.max(usual * 1.3, ...cells.map((c) => c.spent), 1);
  return (
    <Panel title={TODAY_COPY.week.title[tone]}>
      <div className="grid grid-cols-7 items-end gap-2 pt-10 min-[900px]:gap-3" role="list">
        {cells.map((c, i) => {
          const today = c.state === "today";
          const h = c.state === "upcoming" || c.state === "outside" ? 0 : Math.max(10, (c.spent / top) * 100);
          return (
            <div key={c.date} role="listitem" className="grid justify-items-stretch gap-2 text-center">
              <div className="flex h-36 items-end">
                <div
                  className={cn(
                    "relative w-full rounded-xl transition-[height] duration-700",
                    today
                      ? "bg-primary ring-2 ring-foreground ring-offset-2 ring-offset-card"
                      : over(c)
                        ? "bg-destructive"
                        : c.state === "on"
                          ? "bg-[#c9cdd2]"
                          : "bg-secondary",
                  )}
                  style={{ height: today ? `${Math.max(18, h)}%` : h ? `${h}%` : "10%" }}
                  title={c.spent > 0 ? formatMoney(c.spent, currency) : undefined}
                >
                  {(i === worst || today) && (
                    <Sticker
                      variant={today ? "accent" : "danger"}
                      tilt={today ? "right" : "left"}
                      className="absolute bottom-full left-1/2 z-10 mb-2.5 -translate-x-1/2 text-[11px]"
                    >
                      {today ? TODAY_COPY.youAreHere[tone] : fill(TODAY_COPY.weekOver[tone], { day: DAY_LONG[i]! })}
                    </Sticker>
                  )}
                </div>
              </div>
              <span className={cn("text-sm text-muted-foreground", today && "font-bold text-foreground")}>
                {DAY[i]}
              </span>
              <span className="sr-only">
                {DAY_LONG[i]}: {c.spent > 0 ? formatMoney(c.spent, currency) : "nothing yet"}
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

const time = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });

/** The latest few spends, newest first. */
export function RecentSpends({
  txns,
  currency,
  tone,
}: {
  txns: TxnRow[];
  currency: TodayData["currency"];
  tone: Tone;
}) {
  const recent = [...txns].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 4);
  return (
    <Panel
      title={TODAY_COPY.recent.title[tone]}
      aside={
        <Link
          to="/log"
          className="inline-flex items-center gap-1 text-muted-foreground no-underline hover:text-foreground"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Log
        </Link>
      }
    >
      {recent.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">Nothing logged yet this cycle.</p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-4 p-0">
          {recent.map((t) => (
            <li key={t.id} className="flex items-center gap-3.5">
              <span
                aria-hidden="true"
                className="grid size-12 shrink-0 place-items-center rounded-full bg-secondary text-xl"
              >
                {t.category.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{t.note ?? t.category.name}</span>
                <span className="block truncate text-[13px] text-muted-foreground">
                  {t.note ? t.category.name : time.format(new Date(t.occurredAt))}
                </span>
              </span>
              <span className="font-heading text-[17px] font-bold">
                {t.type === "refund" ? "+" : ""}
                {formatMoney(t.amount, currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Button asChild variant="soft" className="h-12 w-full text-[15px] text-foreground">
        <Link to="/transactions">
          {TODAY_COPY.recent.more[tone]}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </Button>
    </Panel>
  );
}
