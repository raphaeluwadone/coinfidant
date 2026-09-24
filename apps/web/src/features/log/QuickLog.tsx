import { autoTag, formatMoney, reactionFor, type Tone } from "@coinfidant/engine";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Mascot } from "../../components/Mascot";
import { todayQuery, type TodayData, type TxnRow } from "../../lib/today";
import { deleteTransaction, logTransaction } from "../../lib/transactions";
import { fromMinorUnits, type Key, press, toMinorUnits } from "./amount";
import "./QuickLog.css";

const KEYS: Key[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];
const fmt = new Intl.NumberFormat("en-NG");

type Saved = { id: string; today: TodayData };

export function QuickLog() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery(todayQuery);
  const [value, setValue] = useState("");
  const categories = data?.categories ?? [];
  const [picked, setCategory] = useState<string | null>(null);
  const category = picked ?? categories[0]?.id ?? null;
  const [note, setNote] = useState<string | undefined>();
  const [saved, setSaved] = useState<Saved | null>(null);

  const currency = data?.currency ?? "NGN";
  const amount = toMinorUnits(value);
  const close = useCallback(() => navigate({ to: "/" }), [navigate]);

  const save = useMutation({
    mutationFn: logTransaction,
    onSuccess: (res) => {
      qc.setQueryData(todayQuery.queryKey, res.today);
      setSaved({ id: res.transaction.id, today: res.today });
    },
  });

  const undo = useMutation({
    mutationFn: deleteTransaction,
    onSuccess: (res) => {
      qc.setQueryData(todayQuery.queryKey, res.today);
      close();
    },
  });

  const submit = useCallback(() => {
    if (amount > 0 && category && !save.isPending) save.mutate({ amount, categoryId: category, note });
  }, [amount, category, note, save]);

  const tap = useCallback((key: Key) => {
    setValue((v) => press(v, key));
    setNote(undefined);
  }, []);

  useEffect(() => {
    if (saved) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-9.]$/.test(e.key)) tap(e.key as Key);
      else if (e.key === "Backspace") tap("back");
      else if (e.key === "Enter") submit();
      else if (e.key === "Escape") close();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saved, tap, submit, close]);

  const presets = useMemo(() => frequentSpends(data?.transactions ?? []), [data?.transactions]);

  if (saved)
    return <Confirmation saved={saved} onDone={close} onUndo={() => undo.mutate(saved.id)} undoing={undo.isPending} />;

  const [int = "", frac] = value.split(".");

  return (
    <main className="log">
      <header className="log__head">
        <h1>Log a spend</h1>
        <button className="log__close" onClick={close} aria-label="Close">
          ✕
        </button>
      </header>

      <div
        className={`log__amount ${value ? "" : "is-empty"}`}
        aria-live="polite"
        aria-label={`Amount ${formatMoney(amount, currency, { showMinor: true })}`}
      >
        {currency}&nbsp;{int ? fmt.format(Number(int)) : "0"}
        {frac !== undefined && <span className="log__frac">.{frac}</span>}
      </div>

      <div className="log__chips" role="radiogroup" aria-label="Category">
        {categories.map((c) => (
          <button
            key={c.id}
            role="radio"
            aria-checked={category === c.id}
            className={`cat-chip ${category === c.id ? "is-on" : ""}`}
            onClick={() => setCategory(c.id)}
          >
            {c.emoji} {c.name}
          </button>
        ))}
      </div>

      {presets.length > 0 && (
        <div className="log__presets">
          {presets.map((p) => (
            <button
              key={`${p.categoryId}|${p.amount}|${p.note ?? ""}`}
              className="preset"
              onClick={() => {
                setValue(fromMinorUnits(p.amount));
                setCategory(p.categoryId);
                setNote(p.note ?? undefined);
              }}
            >
              {p.emoji} {p.note ?? p.name} · {formatMoney(p.amount, currency)}
            </button>
          ))}
        </div>
      )}

      <div className="keypad">
        {KEYS.map((k) => (
          <button
            key={k}
            className={`key ${k === "back" ? "key--muted" : ""}`}
            onClick={() => tap(k)}
            aria-label={k === "back" ? "Delete" : k}
          >
            {k === "back" ? "⌫" : k}
          </button>
        ))}
      </div>

      {save.isError && (
        <p className="log__error" role="alert">
          That didn't save. Check your connection and try again.
        </p>
      )}
      <button className="btn log__save" disabled={amount <= 0 || save.isPending} onClick={submit}>
        {amount > 0 ? `Save ${formatMoney(amount, currency, { showMinor: amount % 100 !== 0 })}` : "Enter an amount"}
      </button>
    </main>
  );
}

function Confirmation({
  saved,
  onDone,
  onUndo,
  undoing,
}: {
  saved: Saved;
  onDone: () => void;
  onUndo: () => void;
  undoing: boolean;
}) {
  const { today } = saved;
  const s = today.snapshot!;
  const tone = today.prefs.personality as Tone;
  const slugged = today.transactions.map((t) => ({ ...t, category: t.category.slug ?? "other" }));
  const spend = slugged.find((t) => t.id === saved.id);
  const tag = spend ? autoTag(spend, slugged, { timeZone: today.prefs.timezone, dailyPace: s.today.dailyPace }) : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Escape") onDone();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  return (
    <main className="log log--done">
      <div className="log__pop">
        <Mascot mood="confirmed" size={72} float={false} />
      </div>
      <p className="log__reaction">{reactionFor(spend?.category ?? "other", tone, s.today.spendToday < 0)}</p>
      <div className="card log__result">
        <div className="label">Left today</div>
        <div className="log__left">{formatMoney(Math.max(0, s.today.spendToday), today.currency)}</div>
        {tag && <span className="log__tag">{tag}</span>}
      </div>
      <button className="btn log__back" onClick={onDone} autoFocus>
        Back to Today
      </button>
      <button className="link-btn log__undo" onClick={onUndo} disabled={undoing}>
        Undo
      </button>
    </main>
  );
}

function frequentSpends(txns: TxnRow[]) {
  const groups = new Map<
    string,
    {
      categoryId: string;
      name: string;
      emoji: string;
      amount: number;
      note: string | null;
      count: number;
      last: string;
    }
  >();
  for (const s of txns) {
    if (s.type !== "spend") continue;
    const key = `${s.categoryId}|${s.amount}|${s.note ?? ""}`;
    const g = groups.get(key);
    if (g) {
      g.count++;
      if (s.occurredAt > g.last) g.last = s.occurredAt;
    } else {
      groups.set(key, {
        categoryId: s.categoryId,
        name: s.category.name,
        emoji: s.category.emoji,
        amount: s.amount,
        note: s.note,
        count: 1,
        last: s.occurredAt,
      });
    }
  }
  return [...groups.values()]
    .filter((g) => g.count >= 2)
    .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last))
    .slice(0, 3);
}
