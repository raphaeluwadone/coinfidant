import { addDays, autoTag, formatMoney, type ISODate, type Tone } from "@coinfidant/engine";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { PersonalitySwitch } from "@/components/PersonalitySwitch";
import { useToast } from "@/components/Toasts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sticker } from "@/components/ui/sticker";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { todayQuery, type TodayData, type TxnRow } from "@/lib/today";
import { deleteTransaction } from "@/lib/transactions";
import { cn } from "@/lib/utils";
import { Panel } from "../today/Cards";
import { TXN_COPY } from "./copy";

const UNDO_MS = 5000;
// Fixed order, so a category keeps its colour however the list is filtered.
const CATEGORY_COLOURS = ["#ff7a45", "#3b82f6", "#ec4899", "#22c55e", "#f59e0b", "#8b5cf6", "#14b8a6", "#ef4444"];

type Period = "week" | "fortnight";
const net = (t: TxnRow) => (t.type === "refund" ? -t.amount : t.amount);

export function Transactions() {
  const { data, isPending } = useQuery(todayQuery);
  const qc = useQueryClient();
  const toast = useToast();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<Period>("week");
  const [category, setCategory] = useState("all");
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const remove = (id: string) => {
    setHidden((h) => new Set(h).add(id));
    const restore = () => {
      clearTimeout(timers.current.get(id));
      timers.current.delete(id);
      setHidden((h) => {
        const next = new Set(h);
        next.delete(id);
        return next;
      });
    };
    timers.current.set(
      id,
      setTimeout(async () => {
        timers.current.delete(id);
        try {
          const res = await deleteTransaction(id);
          qc.setQueryData(todayQuery.queryKey, res.today);
        } catch {
          restore();
          toast({ text: "Couldn't delete that. It's back." });
        }
      }, UNDO_MS),
    );
    toast({ text: "↩️ Deleted. 5s to undo.", action: { label: "Undo", run: restore } }, UNDO_MS);
  };

  if (isPending || !data) return <div className="mx-auto max-w-[1320px]" aria-busy="true" />;
  const tone: Tone = data.stakes ? "gentle" : data.prefs.personality;
  const copy = TXN_COPY;
  const today = data.snapshot?.today.date;
  const from = period === "week" ? (data.snapshot?.today.week.start ?? today) : today && addDays(today, -13);
  const all = [...data.transactions, ...(data.adjustable?.transactions ?? [])].filter((t) => !hidden.has(t.id));
  const inPeriod = all.filter((t) => !from || t.localDate >= from);
  const colour = (id: string) =>
    CATEGORY_COLOURS[data.categories.findIndex((c) => c.id === id) % CATEGORY_COLOURS.length]!;
  const q = query.trim().toLowerCase();
  const shown = inPeriod.filter(
    (t) =>
      (category === "all" || t.categoryId === category) &&
      (!q || `${t.note ?? ""} ${t.category.name}`.toLowerCase().includes(q)),
  );
  const periodLabel = period === "week" ? "this week" : "last 2 weeks";

  return (
    <div className="mx-auto grid max-w-[1320px] grid-cols-[minmax(0,1fr)] gap-6">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <p className="m-0 text-[15px] text-muted-foreground">Transactions</p>
          <h1 className="m-0 mt-1 max-w-[12ch] font-heading text-[clamp(36px,6vw,60px)] leading-[1.02] font-extrabold tracking-[-0.03em]">
            {copy.title[tone]}
          </h1>
          <p className="m-0 mt-2 text-base text-soft">{copy.sub[tone]}</p>
        </div>
        <PersonalitySwitch current={data.prefs.personality} />
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 min-[1200px]:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative min-w-60 flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="sr-only">Search transactions</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={copy.search[tone]}
                className="h-12 w-full rounded-2xl border border-border bg-card pr-4 pl-11 text-[15px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring"
              />
            </label>
            <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <TabsList className="h-12 rounded-2xl border border-border bg-card p-1">
                <TabsTrigger
                  value="week"
                  className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  This week
                </TabsTrigger>
                <TabsTrigger
                  value="fortnight"
                  className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  Last 2 weeks
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <ToggleGroup
            type="single"
            variant="chips"
            value={category}
            onValueChange={(v) => setCategory(v || "all")}
            aria-label="Category"
          >
            <ToggleGroupItem value="all" className="border border-border bg-card">
              ✨ All
            </ToggleGroupItem>
            {data.categories.map((c) => (
              <ToggleGroupItem key={c.id} value={c.id} className="border border-border bg-card">
                {c.emoji} {c.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          {all.length === 0 ? (
            <Empty tone={tone} />
          ) : shown.length === 0 ? (
            <Card className="text-center text-muted-foreground">{copy.nothing[tone]}</Card>
          ) : (
            <DayGroups data={data} txns={shown} today={today} tone={tone} onDelete={remove} />
          )}
        </div>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
          <SpentCard data={data} txns={inPeriod} label={periodLabel} from={from} today={today} />
          <WhereItWent txns={inPeriod} colour={colour} currency={data.currency} tone={tone} />
          <BigSwings txns={inPeriod} currency={data.currency} tone={tone} />
        </div>
      </div>
    </div>
  );
}

const DAY_MS = 86_400_000;

function SpentCard({
  data,
  txns,
  label,
  from,
  today,
}: {
  data: TodayData;
  txns: TxnRow[];
  label: string;
  from?: ISODate;
  today?: ISODate;
}) {
  const spent = txns.reduce((a, t) => a + net(t), 0);
  const days = from && today ? Math.round((Date.parse(today) - Date.parse(from)) / DAY_MS) + 1 : 1;
  const money = (n: number) => formatMoney(n, data.currency);
  return (
    <section
      className="relative isolate overflow-hidden rounded-[28px] bg-primary p-6 text-primary-foreground"
      aria-label={`Spent ${label}`}
    >
      <div
        aria-hidden="true"
        className="absolute -top-20 -right-16 -z-10 size-56 rounded-full border-[36px] border-[var(--accent-ink)]/[0.07]"
      />
      <div className="text-xs font-bold tracking-[0.2em] uppercase opacity-80">Spent · {label}</div>
      <div className="mt-2 font-heading text-[clamp(38px,5vw,52px)] leading-none font-extrabold tracking-[-0.03em]">
        {money(spent)}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-[var(--accent-ink)]/10 px-4 py-3">
          <div className="text-[13px] opacity-75">Daily average</div>
          <div className="font-heading text-lg font-bold">{money(Math.round(spent / Math.max(1, days)))}</div>
        </div>
        <div className="rounded-2xl bg-[var(--accent-ink)]/10 px-4 py-3">
          <div className="text-[13px] opacity-75">Spends logged</div>
          <div className="font-heading text-lg font-bold">{txns.filter((t) => t.type === "spend").length}</div>
        </div>
      </div>
      <Link
        to="/log"
        className="mt-5 flex h-13 items-center justify-center gap-2 rounded-2xl bg-[var(--accent-ink)] font-bold text-[var(--accent)] no-underline transition-transform active:scale-[0.98]"
      >
        <Plus className="size-5" aria-hidden="true" />
        Log a spend
      </Link>
    </section>
  );
}

function WhereItWent({
  txns,
  colour,
  currency,
  tone,
}: {
  txns: TxnRow[];
  colour: (id: string) => string;
  currency: TodayData["currency"];
  tone: Tone;
}) {
  const rows = useMemo(() => {
    const sums = new Map<string, { id: string; label: string; amount: number }>();
    for (const t of txns) {
      const cur = sums.get(t.categoryId) ?? {
        id: t.categoryId,
        label: `${t.category.emoji} ${t.category.name}`,
        amount: 0,
      };
      cur.amount += net(t);
      sums.set(t.categoryId, cur);
    }
    return [...sums.values()].filter((r) => r.amount > 0).sort((a, b) => b.amount - a.amount);
  }, [txns]);
  const total = rows.reduce((a, r) => a + r.amount, 0);
  if (!total) return null;
  return (
    <Panel title={TXN_COPY.breakdown[tone]}>
      <div className="flex h-3.5 gap-1 overflow-hidden rounded-full" aria-hidden="true">
        {rows.map((r) => (
          <span key={r.id} className="h-full rounded-full" style={{ flexGrow: r.amount, background: colour(r.id) }} />
        ))}
      </div>
      <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-3 p-0">
        {rows.map((r) => (
          <li key={r.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 text-[15px]">
            <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: colour(r.id) }} />
            <span className="truncate font-medium">{r.label}</span>
            <span className="text-[13px] text-muted-foreground">{Math.round((r.amount / total) * 100)}%</span>
            <span className="font-heading font-bold">{formatMoney(r.amount, currency)}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function BigSwings({ txns, currency, tone }: { txns: TxnRow[]; currency: TodayData["currency"]; tone: Tone }) {
  const top = [...txns]
    .filter((t) => t.type === "spend")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);
  if (!top.length) return null;
  return (
    <Panel title={TXN_COPY.swings[tone]}>
      <ol className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-3 p-0">
        {top.map((t, i) => (
          <li key={t.id} className="relative flex items-center gap-3 rounded-2xl border border-border px-4 py-3.5">
            {i === 0 && (
              <Sticker variant="danger" tilt="right" className="absolute -top-3 right-3">
                {TXN_COPY.ouch[tone]}
              </Sticker>
            )}
            <span className="font-heading text-2xl font-extrabold text-muted-foreground">{i + 1}</span>
            <span aria-hidden="true" className="text-xl">
              {t.category.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold">{t.note ?? t.category.name}</span>
              <span className="block text-[13px] text-muted-foreground">{shortDay(t.localDate)}</span>
            </span>
            <span className="font-heading text-[17px] font-bold">{formatMoney(t.amount, currency)}</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function DayGroups({
  data,
  txns,
  today,
  tone,
  onDelete,
}: {
  data: TodayData;
  txns: TxnRow[];
  today?: ISODate;
  tone: Tone;
  onDelete: (id: string) => void;
}) {
  const groups = useMemo(() => {
    const byDay = new Map<ISODate, TxnRow[]>();
    for (const t of [...txns].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)))
      byDay.set(t.localDate, [...(byDay.get(t.localDate) ?? []), t]);
    return [...byDay.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [txns]);

  const tagged = useMemo(() => txns.map((t) => ({ ...t, category: t.category.slug ?? "other" })), [txns]);
  const ctx = { timeZone: data.prefs.timezone, dailyPace: data.snapshot?.today.dailyPace ?? 0, tone };
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: data.prefs.timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const closedBefore = data.cycle?.startDate;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      {groups.map(([day, rows]) => {
        const total = rows.reduce((a, t) => a + net(t), 0);
        return (
          <Card asChild key={day} className="grid grid-cols-[minmax(0,1fr)] gap-2 p-5 min-[900px]:p-6">
            <section aria-label={dayLabel(day, today)}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <h2 className="m-0 text-lg">
                  {dayLabel(day, today)}
                  {closedBefore && day < closedBefore && (
                    <span className="ml-2 text-xs font-semibold text-muted-foreground">
                      last cycle · still editable
                    </span>
                  )}
                </h2>
                <span className="text-[15px] text-muted-foreground">{formatMoney(total, data.currency)}</span>
              </div>
              <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] p-0">
                {rows.map((t) => {
                  const tag = t.note
                    ? null
                    : autoTag(
                        tagged.find((x) => x.id === t.id)!,
                        tagged,
                        ctx,
                      );
                  return (
                    <li
                      key={t.id}
                      className="group -mx-3 flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-secondary"
                    >
                      <span
                        aria-hidden="true"
                        className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-xl group-hover:bg-card min-[900px]:size-12"
                      >
                        {t.category.emoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold">{t.note ?? t.category.name}</span>
                        <span className="block truncate text-[13px] text-muted-foreground">
                          {[t.note ? t.category.name : tag, time.format(new Date(t.occurredAt))]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 font-heading text-[15px] font-bold min-[900px]:text-[17px]",
                          t.type === "refund" && "text-success",
                        )}
                      >
                        {t.type === "refund" ? "+" : ""}
                        {formatMoney(t.amount, data.currency)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 max-[899px]:-mr-2 max-[899px]:opacity-60"
                        onClick={() => onDelete(t.id)}
                        aria-label={`Delete ${t.note ?? t.category.name}`}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </section>
          </Card>
        );
      })}
    </div>
  );
}

function Empty({ tone }: { tone: Tone }) {
  return (
    <Card className="grid justify-items-center gap-3 py-12 text-center">
      <span aria-hidden="true" className="text-5xl">
        🦗
      </span>
      <h2 className="m-0 text-xl">No transactions yet</h2>
      <p className="m-0 text-soft">{TXN_COPY.empty[tone]}</p>
      <Button asChild className="mt-2">
        <Link to="/log">Log your first spend</Link>
      </Button>
    </Card>
  );
}

const shortDay = (d: ISODate) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });

function dayLabel(day: ISODate, today?: ISODate) {
  if (day === today) return "Today";
  if (today && day === addDays(today, -1)) return "Yesterday";
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}
