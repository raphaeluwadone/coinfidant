import { autoTag, formatMoney, reactionFor, type Tone } from "@coinfidant/engine";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Mascot } from "@/components/Mascot";
import { Button } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { todayQuery, type TodayData, type TxnRow } from "@/lib/today";
import { deleteTransaction, logTransaction } from "@/lib/transactions";
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
  const [date, setDate] = useState<string | null>(null);
  const [pickingDate, setPickingDate] = useState(false);
  const today = data?.snapshot?.today.date;
  // Back-dating reaches into the last closed cycle while its adjustment window is open.
  const earliest = data?.adjustable?.startDate ?? data?.cycle?.startDate;
  const [saved, setSaved] = useState<Saved | null>(null);

  const currency = data?.currency ?? "NGN";
  const amount = toMinorUnits(value);
  const close = useCallback(() => navigate({ to: "/" }), [navigate]);

  const save = useMutation({
    mutationFn: logTransaction,
    onSuccess: (res) => {
      qc.setQueryData(todayQuery.queryKey, res.today);
      qc.invalidateQueries({ queryKey: ["growth"] });
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
    if (amount > 0 && category && !save.isPending)
      save.mutate({ amount, categoryId: category, note, ...(date && date !== today ? { date } : {}) });
  }, [amount, category, note, save, date, today]);

  const tap = useCallback((key: Key) => setValue((v) => press(v, key)), []);

  useEffect(() => {
    if (saved) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.target instanceof HTMLInputElement) return;
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
        <Button variant="soft" size="icon" className="size-[30px] text-[15px]" onClick={close} aria-label="Close">
          ✕
        </Button>
      </header>

      <div
        className={`log__amount ${value ? "" : "is-empty"}`}
        aria-live="polite"
        aria-label={`Amount ${formatMoney(amount, currency, { showMinor: true })}`}
      >
        {currency}&nbsp;{int ? fmt.format(Number(int)) : "0"}
        {frac !== undefined && <span className="log__frac">.{frac}</span>}
      </div>

      <div className="log__when">
        {pickingDate && today && earliest ? (
          <Input
            className="h-9 w-auto"
            type="date"
            min={earliest}
            max={today}
            value={date ?? today}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            onBlur={() => setPickingDate(false)}
            aria-label="Date"
            autoFocus
          />
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-auto px-3 py-1.5 text-xs text-soft"
            onClick={() => setPickingDate(true)}
          >
            📅 {!date || date === today ? "Today" : dayName(date)}
          </Button>
        )}
      </div>

      <Input
        className="log__title mb-3.5 h-11 text-center"
        placeholder="What was it? (optional)"
        maxLength={120}
        value={note ?? ""}
        onChange={(e) => setNote(e.target.value || undefined)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        aria-label="What was it"
      />

      <ToggleGroup
        type="single"
        variant="chips"
        value={category ?? ""}
        onValueChange={(v) => v && setCategory(v)}
        aria-label="Category"
        className="log__chips flex-nowrap"
      >
        {categories.map((c) => (
          <ToggleGroupItem key={c.id} value={c.id}>
            {c.emoji} {c.name}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {presets.length > 0 && (
        <div className="log__presets">
          {presets.map((p) => (
            <Button
              key={`${p.categoryId}|${p.amount}|${p.note ?? ""}`}
              variant="outline"
              size="sm"
              className="h-auto rounded-field px-3 py-2 text-xs font-semibold text-soft hover:border-accent-foreground hover:bg-transparent"
              onClick={() => {
                setValue(fromMinorUnits(p.amount));
                setCategory(p.categoryId);
                setNote(p.note ?? undefined);
              }}
            >
              {p.emoji} {p.note ?? p.name} · {formatMoney(p.amount, currency)}
            </Button>
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
      <Button className="log__save" disabled={amount <= 0 || save.isPending} onClick={submit}>
        {amount > 0 ? `Save ${formatMoney(amount, currency, { showMinor: amount % 100 !== 0 })}` : "Enter an amount"}
      </Button>
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
  const tag = spend
    ? autoTag(spend, slugged, {
        timeZone: today.prefs.timezone,
        dailyPace: s.today.dailyPace,
        tone: today.stakes ? "gentle" : tone,
      })
    : null;

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
      <p className="log__reaction">
        {reactionFor(spend?.category ?? "other", tone, s.today.spendToday < 0, { stakes: today.stakes })}
      </p>
      <Card className="log__result">
        <Eyebrow className="font-semibold">Left today</Eyebrow>
        <div className="log__left">{formatMoney(Math.max(0, s.today.spendToday), today.currency)}</div>
        {tag && <span className="log__tag">{tag}</span>}
      </Card>
      <Button className="log__back" onClick={onDone} autoFocus>
        Back to Today
      </Button>
      <Button variant="muted" size="inline" className="justify-self-center" onClick={onUndo} disabled={undoing}>
        Undo
      </Button>
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

const dayName = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
