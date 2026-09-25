import { addDays, autoTag, formatMoney, type ISODate } from "@coinfidant/engine";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useToast } from "../../components/Toasts";
import { todayQuery, type TodayData, type TxnRow } from "../../lib/today";
import { deleteTransaction } from "../../lib/transactions";
import "./Transactions.css";

const UNDO_MS = 5000;

export function Transactions() {
  const { data, isPending } = useQuery(todayQuery);
  const qc = useQueryClient();
  const toast = useToast();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
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

  if (isPending || !data) return <div className="txns" aria-busy="true" />;
  const visible = data.transactions.filter((t) => !hidden.has(t.id));
  const lastCycle = (data.adjustable?.transactions ?? []).filter((t) => !hidden.has(t.id));
  const today = data.snapshot?.today.date;

  return (
    <div className="txns">
      <header className="txns__head">
        <h1>Transactions</h1>
        <Link to="/settings" className="round-btn" aria-label="Settings">
          ⚙️
        </Link>
      </header>

      {visible.length === 0 && lastCycle.length === 0 ? (
        <Empty />
      ) : (
        <div className="txns__grid">
          <div className="txns__days">
            <DayGroups data={data} txns={visible} today={today} onDelete={remove} />
            {lastCycle.length > 0 && (
              <>
                <h2 className="txns__cyclehead">LAST CYCLE · editable until your next payday</h2>
                <DayGroups data={data} txns={lastCycle} today={today} onDelete={remove} />
              </>
            )}
          </div>
          {data.snapshot && (
            <WeekByCategory txns={visible} weekStart={data.snapshot.today.week.start} currency={data.currency} />
          )}
        </div>
      )}
    </div>
  );
}

function DayGroups({
  data,
  txns,
  today,
  onDelete,
}: {
  data: TodayData;
  txns: TxnRow[];
  today?: ISODate;
  onDelete: (id: string) => void;
}) {
  const groups = useMemo(() => {
    const byDay = new Map<ISODate, TxnRow[]>();
    for (const t of [...txns].reverse()) byDay.set(t.localDate, [...(byDay.get(t.localDate) ?? []), t]);
    return [...byDay.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [txns]);

  const tagged = useMemo(() => txns.map((t) => ({ ...t, category: t.category.slug ?? "other" })), [txns]);
  const ctx = {
    timeZone: data.prefs.timezone,
    dailyPace: data.snapshot?.today.dailyPace ?? 0,
    tone: data.stakes ? ("gentle" as const) : data.prefs.personality,
  };
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: data.prefs.timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div className="txns__days">
      {groups.map(([day, rows]) => {
        const total = rows.reduce((a, t) => a + (t.type === "refund" ? -t.amount : t.amount), 0);
        return (
          <section key={day} className="txns__day">
            <h2 className="txns__dayhead">
              {dayLabel(day, today)} · {formatMoney(total, data.currency)}
            </h2>
            <ul className="card txns__list">
              {rows.map((t) => {
                const tag = autoTag(
                  tagged.find((x) => x.id === t.id)!,
                  tagged,
                  ctx,
                );
                return (
                  <li key={t.id} className="txn">
                    <span className="txn__emoji" aria-hidden="true">
                      {t.category.emoji}
                    </span>
                    <div className="txn__main">
                      <div className="txn__title">{t.category.name}</div>
                      {t.note ? (
                        <div className="txn__sub is-note">{t.note}</div>
                      ) : (
                        <div className="txn__sub">{tag}</div>
                      )}
                    </div>
                    <div className="txn__side">
                      <div className="txn__amount">
                        {t.type === "refund" ? "+" : ""}
                        {formatMoney(t.amount, data.currency)}
                      </div>
                      <div className="txn__time">{time.format(new Date(t.occurredAt)).replace(" ", "")}</div>
                    </div>
                    <button
                      className="txn__delete"
                      onClick={() => onDelete(t.id)}
                      aria-label={`Delete ${t.category.name}`}
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function WeekByCategory({
  txns,
  weekStart,
  currency,
}: {
  txns: TxnRow[];
  weekStart: ISODate;
  currency: TodayData["currency"];
}) {
  const rows = useMemo(() => {
    const sums = new Map<string, { label: string; amount: number }>();
    for (const t of txns) {
      if (t.localDate < weekStart) continue;
      const cur = sums.get(t.categoryId) ?? { label: `${t.category.emoji} ${t.category.name}`, amount: 0 };
      cur.amount += t.type === "refund" ? -t.amount : t.amount;
      sums.set(t.categoryId, cur);
    }
    return [...sums.values()].sort((a, b) => b.amount - a.amount);
  }, [txns, weekStart]);

  if (!rows.length) return null;
  return (
    <aside className="card txns__week">
      <h2>This week by category</h2>
      <ul>
        {rows.map((r) => (
          <li key={r.label}>
            <span>{r.label}</span>
            <strong>{formatMoney(r.amount, currency)}</strong>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function Empty() {
  return (
    <div className="txns__empty">
      <div className="txns__empty-emoji" aria-hidden="true">
        🦗
      </div>
      <h2>No transactions yet</h2>
      <p>
        Your account is suspiciously quiet 🦗
        <br />
        Log something and break the silence.
      </p>
      <Link to="/log" className="btn">
        Log your first spend
      </Link>
    </div>
  );
}

function dayLabel(day: ISODate, today?: ISODate) {
  if (day === today) return "TODAY";
  if (today && day === addDays(today, -1)) return "YESTERDAY";
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!))
    .toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" })
    .toUpperCase();
}
