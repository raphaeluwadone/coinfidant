import {
  type CurrencyCode,
  type DayCell,
  hasEvent,
  type OpenCycle,
  type DayState,
  type DiscoveryProgress,
  formatMoney,
  PACE_LABEL,
  paceStatus,
  quipsFor,
  TONES,
  todayMood,
  toDayNum,
} from "@coinfidant/engine";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mascot } from "@/components/Mascot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import type { SessionUser } from "@/lib/auth";
import { paydayDue, todayQuery, type TodayData } from "@/lib/today";
import { markSalaryReceived } from "@/lib/transactions";
import { learnedQueryKey } from "../discovery/Discovery";
import { JourneyStrip, PhaseCard, phaseLine, PhasePill, WorthKnowing } from "../phases/PhaseParts";
import "./Today.css";

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const STATE_LABEL: Record<DayState, string> = {
  on: "On budget",
  covered: "Over, but the week covers it",
  over: "Over budget",
  today: "Today",
  upcoming: "Upcoming",
  outside: "Outside this cycle",
};

export function Today({ user }: { user: SessionUser }) {
  const { data, isPending, isError, refetch } = useQuery(todayQuery);

  if (isPending) return <TodaySkeleton />;
  if (isError || !data)
    return (
      <div className="today">
        <Card className="grid justify-items-start gap-3">
          <p className="m-0">Couldn't load today. The internet might be napping.</p>
          <Button onClick={() => refetch()}>Try again</Button>
        </Card>
      </div>
    );

  if (!data.snapshot) return <SalaryPrompt />;
  return <TodayView data={data} snapshot={data.snapshot} user={user} />;
}

function TodayView({ data, snapshot: s, user }: { data: TodayData; snapshot: OpenCycle; user: SessionUser }) {
  const currency = data.currency;
  const tone = TONES.find((t) => t.key === data.prefs.personality) ?? TONES[1]!;
  const learning = !!data.discovery;
  // Discovery is judgment-free: no pace verdicts or "over" colouring until the cycle has taught us real numbers.
  const pace = paceStatus(s);
  const mood = learning ? (s.today.spentToday > 0 ? "onTrack" : "fresh") : todayMood(s);
  const daysDone = s.today.strip.filter((d) => d.state === "on" || d.state === "covered" || d.state === "over").length;
  const date = new Date(toDayNum(s.today.date) * 86_400_000);
  const fmtDate = (o: Intl.DateTimeFormatOptions) => date.toLocaleDateString("en-GB", { timeZone: "UTC", ...o });
  // During discovery the phase is still a guess, so the plain chips stand in for the phase pieces.
  const phase = learning ? null : data.phase;
  const flavour = phase ? phaseLine(data, tone.key) : null;
  const quips = quipsFor(mood, tone.key, { stakes: data.stakes });

  return (
    <div className="today">
      <header className="today__header">
        <div className="today__hello">
          <Mascot size={40} />
          <div>
            <h1>Hey {user.displayName ?? "there"} 👋</h1>
            <p className="today__date today__date--short">
              {fmtDate({ weekday: "short", month: "short", day: "numeric" })}
            </p>
            <p className="today__date today__date--long">
              {fmtDate({ weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>
        <div className="today__tools">
          {phase && <PhasePill phase={phase.phase} />}
          <Badge className="min-[900px]:px-3 min-[900px]:py-2">
            {tone.emoji} {tone.label}
            <span className="pill__suffix"> mode</span>
          </Badge>
          <Button
            asChild
            variant="surface"
            size="icon"
            className="size-[34px] min-[900px]:size-[38px] min-[900px]:text-[17px]"
          >
            <Link to="/settings" aria-label="Settings">
              ⚙️
            </Link>
          </Button>
        </div>
      </header>

      {s.cycle.overrunDays > 0 && <SalaryPrompt compact overdue={hasEvent(s, "salaryOverdue")} />}
      {data.discovery && <DiscoveryCard progress={data.discovery} />}
      {phase && <JourneyStrip phase={phase} />}
      {s.today.daysLeftInWeek <= 1 && s.today.week.spent > 0 && (
        <Card asChild className="coach-nudge">
          <Link to="/coach">
            <span aria-hidden="true">🔮</span>
            <span>Week's nearly done. Want Pix's read on it? →</span>
          </Link>
        </Card>
      )}

      <div className="today__grid">
        <Card asChild className="hero">
          <section>
            <Eyebrow className="mb-2 text-[13px] font-semibold tracking-[0.02em]">You can spend today</Eyebrow>
            <div className="hero__amount">{formatMoney(Math.max(0, s.today.spendToday), currency)}</div>
            <Quip key={`${mood}-${tone.key}`} lines={flavour ? [quips[0]!, flavour, ...quips.slice(1)] : quips} />
            <div className="stats">
              <div className="stat">
                <div className="stat__label">Left this week</div>
                <div className={`stat__value ${s.today.leftThisWeek < 0 && !learning ? "is-over" : ""}`}>
                  {formatMoney(s.today.leftThisWeek, currency)}
                </div>
              </div>
              <div className="stat">
                <div className="stat__label">Daily avg pace</div>
                {learning ? (
                  <div className="stat__value pace--learning">Learning 🔍</div>
                ) : (
                  <div className={`stat__value pace--${pace}`}>{PACE_LABEL[pace]}</div>
                )}
              </div>
            </div>
            {!phase && <StatusChips snapshot={s} currency={currency} className="chips chips--desktop" />}
          </section>
        </Card>

        <Card asChild className="week">
          <section>
            <div className="week__head">
              <h2>This week</h2>
              <span>
                {daysDone} of {s.today.week.days} days done
              </span>
            </div>
            <WeekStrip cells={s.today.strip} />
            <ul className="week__list">
              {s.today.strip.map((d, i) => (
                <li key={d.date} className={`week__row is-${d.state}`}>
                  <span className="week__cell">{DAY_LETTERS[i]}</span>
                  <span className="week__label" title={DAY_NAMES[i]}>
                    {STATE_LABEL[d.state]}
                  </span>
                  {d.spent > 0 && <span className="week__spent">{formatMoney(d.spent, currency)}</span>}
                </li>
              ))}
            </ul>
            <div className="week__links">
              <Button asChild variant="link" size="inline" className="week__all">
                <Link to="/transactions">See transactions →</Link>
              </Button>
              <Button asChild variant="link" size="inline" className="week__all">
                <Link to="/history">History →</Link>
              </Button>
            </div>
          </section>
        </Card>

        {phase ? (
          <>
            <WorthKnowing data={data} />
            <PhaseCard data={data} />
          </>
        ) : (
          <>
            <StatusChips snapshot={s} currency={currency} className="chips chips--mobile" />
            <WorthKnowing data={data} />
          </>
        )}
      </div>
    </div>
  );
}

function WeekStrip({ cells }: { cells: DayCell[] }) {
  return (
    <div className="strip" role="list">
      {cells.map((d, i) => (
        <div
          key={d.date}
          className={`strip__day is-${d.state}`}
          role="listitem"
          aria-label={`${DAY_NAMES[i]}: ${STATE_LABEL[d.state]}`}
        >
          <div className="strip__bar" style={{ animationDelay: `${0.05 + i * 0.04}s` }} />
          <span>{DAY_LETTERS[i]}</span>
        </div>
      ))}
    </div>
  );
}

function StatusChips({
  snapshot: s,
  currency,
  className,
}: {
  snapshot: OpenCycle;
  currency: CurrencyCode;
  className: string;
}) {
  const net = s.savings.net;
  return (
    <div className={className}>
      <div className="chip chip--bills">
        <div className="chip__title">🏠 Bills</div>
        <div className="chip__sub">
          {s.plan.bills > 0 ? `${formatMoney(s.plan.bills, currency)} set aside` : "No fixed bills. Lucky you."}
        </div>
      </div>
      <div className="chip chip--goal">
        <div className="chip__title">🎯 Savings</div>
        <div className="chip__sub">
          {s.savings.borrowed > 0 && net < s.savings.planned
            ? `Borrowed ${formatMoney(s.savings.borrowed, currency)} this cycle`
            : `+${formatMoney(net, currency)} this cycle`}
        </div>
      </div>
    </div>
  );
}

function Quip({ lines }: { lines: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (lines.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % lines.length), 8000);
    return () => clearInterval(t);
  }, [lines]);
  return (
    <p key={i} className="hero__quip" aria-live="polite">
      {lines[i % lines.length]}
    </p>
  );
}

function TodaySkeleton() {
  return (
    <div className="today" aria-busy="true" aria-label="Loading">
      <div className="skeleton" style={{ height: 40, width: 180 }} />
      <Card className="hero">
        <div className="skeleton" style={{ height: 12, width: 140 }} />
        <div className="skeleton" style={{ height: 58, width: "75%", marginTop: 12 }} />
        <div className="skeleton" style={{ height: 16, width: "55%", marginTop: 12 }} />
      </Card>
      <Card>
        <div className="skeleton" style={{ height: 34 }} />
      </Card>
    </div>
  );
}

function DiscoveryCard({ progress: p }: { progress: DiscoveryProgress }) {
  return (
    <Card asChild className="discovery-card">
      <Link to="/discovery">
        <span className="discovery-card__badge">
          🔍 Discovery cycle · Day {p.day} of {p.days}
        </span>
        <div className="discovery-card__bar" aria-hidden="true">
          <div style={{ width: `${p.confidence}%` }} />
        </div>
        <span className="discovery-card__meta">
          {p.confidence}% confident in your numbers · See what we've learned →
        </span>
      </Link>
    </Card>
  );
}

/** Asks whether salary has landed; confirming closes the old cycle and opens today's. */
function SalaryPrompt({ compact = false, overdue = false }: { compact?: boolean; overdue?: boolean }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const mark = useMutation({
    mutationFn: () => markSalaryReceived(),
    onSuccess: async (res) => {
      qc.setQueryData(todayQuery.queryKey, res.today);
      await qc.invalidateQueries({ queryKey: ["budget"] });
      qc.setQueryData(learnedQueryKey, res.learned);
      await qc.invalidateQueries({ queryKey: ["history"] });
      qc.invalidateQueries({ queryKey: ["growth"] });
      if (res.closedCycleId) navigate({ to: "/cycles/$id", params: { id: res.closedCycleId }, search: { flow: true } });
      else if (paydayDue(res.today)) navigate({ to: "/payday" });
    },
  });
  return (
    <Card asChild className={`salary-prompt ${compact ? "is-compact" : ""}`}>
      <section>
        {!compact && <Mascot mood="happy" size={56} />}
        <div>
          <h2>{compact && !overdue ? "Payday! 💸 Did your salary land?" : "Did your salary land?"}</h2>
          <p>Say the word and we'll close off the last cycle and plan the new one.</p>
        </div>
        <Button onClick={() => mark.mutate()} disabled={mark.isPending}>
          Yes, it landed today
        </Button>
        {mark.isError && <p role="alert">That didn't go through. Try again?</p>}
      </section>
    </Card>
  );
}
