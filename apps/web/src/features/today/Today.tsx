import {
  type DiscoveryProgress,
  hasEvent,
  type OpenCycle,
  quipsFor,
  TONES,
  type Tone,
  todayMood,
  toDayNum,
} from "@coinfidant/engine";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Mascot } from "@/components/Mascot";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { SessionUser } from "@/lib/auth";
import { type BudgetData, budgetQuery, savePreferences } from "@/lib/budget";
import { paydayDue, todayQuery, type TodayData } from "@/lib/today";
import { markSalaryReceived } from "@/lib/transactions";
import { learnedQueryKey } from "../discovery/Discovery";
import {
  Checklist,
  GoalsGrid,
  HitList,
  People,
  phaseLine,
  SafetyNets,
  TargetCard,
  WorthKnowing,
} from "../phases/PhaseParts";
import { GlowUp, RecentSpends, WeekChart } from "./Cards";
import { greeting, TODAY_COPY } from "./copy";
import { Hero } from "./Hero";

export function Today({ user }: { user: SessionUser }) {
  const { data, isPending, isError, refetch } = useQuery(todayQuery);

  if (isPending) return <TodaySkeleton />;
  if (isError || !data)
    return (
      <Card className="mx-auto grid max-w-xl justify-items-start gap-3">
        <p className="m-0">Couldn't load today. The internet might be napping.</p>
        <Button onClick={() => refetch()}>Try again</Button>
      </Card>
    );

  if (!data.snapshot) return <SalaryPrompt />;
  return <TodayView data={data} snapshot={data.snapshot} user={user} />;
}

function TodayView({ data, snapshot: s, user }: { data: TodayData; snapshot: OpenCycle; user: SessionUser }) {
  const { data: budgetData } = useQuery(budgetQuery);
  const budget = budgetData?.budget;
  const learning = !!data.discovery;
  // The stakes override keeps every tone warm, the interface copy included.
  const tone: Tone = data.stakes ? "gentle" : data.prefs.personality;
  const phase = learning ? null : data.phase;
  const kind = phase?.phase ?? "discovery";
  const mood = learning ? (s.today.spentToday > 0 ? "onTrack" : "fresh") : todayMood(s);
  const quips = quipsFor(mood, tone, { stakes: data.stakes });
  const flavour = phase ? phaseLine(data, tone) : null;
  const lines = flavour ? [quips[0]!, flavour, ...quips.slice(1)] : quips;
  const date = new Date(toDayNum(s.today.date) * 86_400_000).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const usual = s.today.week.days > 0 ? Math.floor(s.today.week.budget / s.today.week.days) : 0;
  const props = budget ? { data, budget, tone } : null;

  const week = <WeekChart key="week" cells={s.today.strip} usual={usual} currency={data.currency} tone={tone} />;
  const recent = <RecentSpends key="recent" txns={data.transactions} currency={data.currency} tone={tone} />;
  const glow = phase ? <GlowUp key="glow" phase={phase} tone={tone} /> : null;
  const layout: Record<typeof kind, { main: ReactNode[]; side: ReactNode[] }> = {
    stabilise: {
      main: [week, props && <SafetyNets key="nets" {...props} />],
      side: [glow, recent, props && <Checklist key="list" {...props} />],
    },
    attack: {
      main: [week, recent],
      side: [glow, props && <TargetCard key="target" {...props} />, props && <HitList key="hits" {...props} />],
    },
    build: {
      main: [props && <GoalsGrid key="goals" {...props} />, week],
      side: [glow, props && <People key="people" {...props} />, recent],
    },
    discovery: { main: [week], side: [recent] },
  };
  const { main, side } = layout[kind];

  return (
    <div className="mx-auto grid max-w-[1320px] gap-6">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <p className="m-0 text-[15px] text-muted-foreground">{date}</p>
          <h1 className="m-0 mt-1 font-heading text-[clamp(32px,5vw,52px)] leading-tight font-extrabold tracking-[-0.02em]">
            {greeting()}, {user.displayName?.split(" ")[0] ?? "there"}{" "}
            {TONES.find((x) => x.key === data.prefs.personality)?.emoji}
          </h1>
          <p className="m-0 mt-1.5 text-base text-soft">{TODAY_COPY.subtitle[kind][tone]}</p>
        </div>
        <PersonalitySwitch current={data.prefs.personality} />
      </header>

      {s.cycle.overrunDays > 0 && <SalaryPrompt compact overdue={hasEvent(s, "salaryOverdue")} />}
      {data.discovery && <DiscoveryCard progress={data.discovery} />}
      {s.today.daysLeftInWeek <= 1 && s.today.week.spent > 0 && (
        <Card
          asChild
          className="flex items-center gap-3 border-0 bg-accent px-5 py-4 text-[15px] font-bold text-accent-foreground"
        >
          <Link to="/coach">
            <span aria-hidden="true">🔮</span>
            Week's nearly done. Want Pix's read on it? →
          </Link>
        </Card>
      )}

      <div className="grid items-start gap-6 min-[1200px]:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid min-w-0 gap-6">
          <Hero data={data} snapshot={s} budget={budget} kind={kind} tone={tone} quips={lines} />
          {main}
          <WorthKnowing data={data} />
        </div>
        <div className="grid min-w-0 gap-6">{side}</div>
      </div>
    </div>
  );
}

/** The tone dial, where the design keeps it: one tap from Today. */
function PersonalitySwitch({ current }: { current: Tone }) {
  const qc = useQueryClient();
  const prefs = useMutation({
    mutationFn: savePreferences,
    onMutate: (patch) =>
      qc.setQueryData<BudgetData | null>(budgetQuery.queryKey, (d) =>
        d ? { ...d, prefs: { ...d.prefs, ...patch } } : d,
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: todayQuery.queryKey }),
  });
  return (
    <div className="hidden gap-2 min-[1000px]:grid">
      <span className="text-[11px] font-bold tracking-[0.18em] text-muted-foreground uppercase">Personality</span>
      <ToggleGroup
        type="single"
        value={current}
        onValueChange={(v) => v && prefs.mutate({ personality: v as Tone })}
        aria-label="Personality"
        className="border border-border bg-card p-1"
      >
        {TONES.map((x) => (
          <ToggleGroupItem
            key={x.key}
            value={x.key}
            className="px-4 py-2 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            {x.emoji} {x.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

function TodaySkeleton() {
  const block = "animate-pulse rounded-2xl bg-secondary";
  return (
    <div className="mx-auto grid max-w-[1320px] gap-6" aria-busy="true" aria-label="Loading">
      <div className={`${block} h-24 w-80 max-w-full`} />
      <div className="grid gap-6 min-[1200px]:grid-cols-[minmax(0,1fr)_420px]">
        <div className={`${block} h-[380px] rounded-[28px]`} />
        <div className={`${block} h-[240px]`} />
      </div>
    </div>
  );
}

function DiscoveryCard({ progress: p }: { progress: DiscoveryProgress }) {
  return (
    <Card asChild className="grid gap-2.5 px-5 py-4 text-foreground transition-colors hover:bg-secondary">
      <Link to="/discovery">
        <span className="text-sm font-bold text-accent-foreground">
          🔍 Discovery cycle · Day {p.day} of {p.days}
        </span>
        <span className="block h-2 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
          <span className="block h-full rounded-full bg-primary" style={{ width: `${p.confidence}%` }} />
        </span>
        <span className="text-[13px] text-muted-foreground">
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
    <Card
      asChild
      className={
        compact
          ? "flex w-full flex-wrap items-center gap-4 border-0 bg-accent px-5 py-4"
          : "mx-auto grid max-w-xl justify-items-start gap-3"
      }
    >
      <section>
        {!compact && <Mascot mood="happy" size={56} />}
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-lg">
            {compact && !overdue ? "Payday! 💸 Did your salary land?" : "Did your salary land?"}
          </h2>
          <p className="m-0 mt-1 text-soft">Say the word and we'll close off the last cycle and plan the new one.</p>
        </div>
        <Button onClick={() => mark.mutate()} disabled={mark.isPending}>
          Yes, it landed today
        </Button>
        {mark.isError && <p role="alert">That didn't go through. Try again?</p>}
      </section>
    </Card>
  );
}
