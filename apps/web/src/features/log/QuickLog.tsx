import {
  autoTag,
  CATEGORIES,
  type CategoryKey,
  categoryOf,
  formatMoney,
  reactionFor,
  type Tone,
} from "@coinfidant/engine";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Mascot } from "../../components/Mascot";
import { deleteSpend, logSpend } from "../../lib/spends";
import { todayQuery, type SpendRow, type TodayData } from "../../lib/today";
import { fromMinorUnits, type Key, press, toMinorUnits } from "./amount";
import "./QuickLog.css";

const KEYS: Key[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];
const fmt = new Intl.NumberFormat("en-NG");

type Saved = { spend: SpendRow; today: TodayData };

export function QuickLog() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery(todayQuery);
  const [value, setValue] = useState("");
  const [category, setCategory] = useState<CategoryKey>("food");
  const [note, setNote] = useState<string | undefined>();
  const [saved, setSaved] = useState<Saved | null>(null);

  const currency = data?.profile.currency ?? "NGN";
  const amount = toMinorUnits(value);
  const close = useCallback(() => navigate({ to: "/" }), [navigate]);

  const save = useMutation({
    mutationFn: logSpend,
    onSuccess: (res) => {
      qc.setQueryData(todayQuery.queryKey, res.today);
      setSaved(res);
    },
  });

  const undo = useMutation({
    mutationFn: deleteSpend,
    onSuccess: (res) => {
      qc.setQueryData(todayQuery.queryKey, res.today);
      close();
    },
  });

  const submit = useCallback(() => {
    if (amount > 0 && !save.isPending) save.mutate({ amount, category, note });
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

  const presets = useMemo(() => frequentSpends(data?.spends ?? []), [data?.spends]);

  if (saved)
    return (
      <Confirmation saved={saved} onDone={close} onUndo={() => undo.mutate(saved.spend.id)} undoing={undo.isPending} />
    );

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
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            role="radio"
            aria-checked={category === c.key}
            className={`cat-chip ${category === c.key ? "is-on" : ""}`}
            onClick={() => setCategory(c.key)}
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {presets.length > 0 && (
        <div className="log__presets">
          {presets.map((p) => (
            <button
              key={`${p.category}|${p.amount}|${p.note ?? ""}`}
              className="preset"
              onClick={() => {
                setValue(fromMinorUnits(p.amount));
                setCategory(p.category);
                setNote(p.note ?? undefined);
              }}
            >
              {categoryOf(p.category).emoji} {p.note ?? categoryOf(p.category).label} ·{" "}
              {formatMoney(p.amount, currency)}
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
  const { spend, today } = saved;
  const s = today.snapshot;
  const tone = today.profile.personality as Tone;
  const tag = autoTag(spend, today.spends, { timeZone: today.profile.timezone, dailyPace: s.today.dailyPace });

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
      <p className="log__reaction">{reactionFor(spend.category, tone, s.today.spendToday < 0)}</p>
      <div className="card log__result">
        <div className="label">Left today</div>
        <div className="log__left">{formatMoney(Math.max(0, s.today.spendToday), today.profile.currency)}</div>
        <span className="log__tag">{tag}</span>
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

function frequentSpends(spends: SpendRow[]) {
  const groups = new Map<
    string,
    { category: CategoryKey; amount: number; note: string | null; count: number; last: string }
  >();
  for (const s of spends) {
    const key = `${s.category}|${s.amount}|${s.note ?? ""}`;
    const g = groups.get(key);
    if (g) {
      g.count++;
      if (s.occurredAt > g.last) g.last = s.occurredAt;
    } else {
      groups.set(key, {
        category: s.category as CategoryKey,
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
