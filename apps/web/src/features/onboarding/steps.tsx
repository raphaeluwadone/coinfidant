import type { DebtInput, OnboardingInput } from "@coinfidant/contracts";
import {
  billsLine,
  debtsLine,
  everydayLine,
  formatMoney,
  goalsLine,
  type ISODate,
  paydayLine,
  paydayModeSample,
  sinkingLine,
  sinkingSetAside,
  sweepPreview,
  TONES,
  type Tone,
} from "@coinfidant/engine";
import { type ComponentProps, type ReactNode, useState } from "react";
import { MoneyInput } from "@/components/MoneyInput";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toggle, ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { OnboardingMascot } from "./OnboardingMascot";
import { type Answers, billEmoji, CREDITORS, creditorEmoji, salaryDate } from "./state";

export type StepProps = { a: Answers; set: (patch: Partial<Answers>) => void; today: ISODate };

const Head = ({ title, sub }: { title: string; sub?: string }) => (
  <header className="ob-head">
    <h1>{title}</h1>
    {sub && <p>{sub}</p>}
  </header>
);

const Reaction = ({ children }: { children: ReactNode }) => (
  <p className="ob-reaction" aria-live="polite">
    {children}
  </p>
);

const Label = ({ children }: { children: ReactNode }) => <div className="ob-label">{children}</div>;

/** Onboarding's compact card: tighter than the app's, same component. */
const ObCard = ({ className, ...props }: ComponentProps<typeof Card>) => (
  <Card className={cn("rounded-field px-3.5 py-3 shadow-[0_0_8px_rgba(0,0,0,0.05)]", className)} {...props} />
);

const ROW_ICON = "size-6 text-[11px] text-muted-foreground hover:text-foreground";

const RowActions = ({ onEdit, onRemove, what }: { onEdit: () => void; onRemove: () => void; what: string }) => (
  <span className="flex shrink-0 gap-1.5">
    <Button variant="soft" size="icon" className={ROW_ICON} onClick={onEdit} aria-label={`Edit ${what}`}>
      ✎
    </Button>
    <Button variant="soft" size="icon" className={ROW_ICON} onClick={onRemove} aria-label={`Remove ${what}`}>
      ✕
    </Button>
  </span>
);

/** An item's form opened in place of its row, prefilled, saving back to the same slot. */
const EditCard = ({ children }: { children: ReactNode }) => <ObCard className="ob-form">{children}</ObCard>;

function Adder({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button
        variant="outline"
        className="h-auto justify-start rounded-field border-2 border-dashed px-3.5 py-3 text-[13px] text-muted-foreground hover:border-accent-foreground hover:bg-transparent hover:text-accent-foreground active:scale-100"
        onClick={() => setOpen(true)}
      >
        + {label}
      </Button>
    );
  return <ObCard className="ob-form">{children(() => setOpen(false))}</ObCard>;
}

const without = <T,>(list: T[], i: number) => list.filter((_, k) => k !== i);
const replaceAt = <T,>(list: T[], i: number, item: T) => list.map((x, k) => (k === i ? item : x));

type FormProps<T> = { initial?: T; onAdd: (item: T) => void; onCancel: () => void };

// Step 1
export function Welcome({ a, set }: StepProps) {
  return (
    <div className="ob-welcome">
      <OnboardingMascot />
      <h1>Hey, I'm Coinfidant 👋</h1>
      <p className="ob-welcome__intro">
        Your loyal, slightly chaotic money friend. Five minutes and I'll build you a real plan.
      </p>
      <div className="ob-label ob-welcome__ask">How much sass do you want?</div>
      <ToggleGroup
        type="single"
        variant="chips"
        value={a.personality}
        onValueChange={(v) => v && set({ personality: v as Tone })}
        aria-label="Personality"
        className="w-full flex-nowrap"
      >
        {TONES.map((t) => (
          <ToggleGroupItem
            key={t.key}
            value={t.key}
            className="grid flex-1 gap-1 rounded-[14px] bg-card px-1.5 py-3 text-[11px] font-bold shadow-[0_0_10px_rgba(0,0,0,0.05)] active:scale-[0.96] data-[state=on]:shadow-[0_6px_16px_rgba(79,70,229,0.35)]"
          >
            <span className="text-xl">{t.emoji}</span>
            {t.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <ObCard className="ob-preview">"{sweepPreview(4_200_00)[a.personality]}"</ObCard>
    </div>
  );
}

// Step 2
const GROW_CHIP = "flex-1 bg-card p-2.5";

const PAYDAY_PICKS = [
  { day: 31, label: "31st / 1st" },
  { day: 25, label: "25th" },
];

export function Payday({ a, set, today }: StepProps) {
  const [other, setOther] = useState(!PAYDAY_PICKS.some((p) => p.day === a.expectedPayday));
  return (
    <>
      <Head title="When does money land? 💸" sub="Salary amount and payday." />
      <Label>Monthly salary</Label>
      <MoneyInput
        className="ob-money"
        value={a.salary}
        onChange={(salary) => set({ salary })}
        aria-label="Monthly salary"
        autoFocus
      />
      <Label>Payday</Label>
      <ToggleGroup
        type="single"
        variant="chips"
        value={other ? "other" : String(a.expectedPayday)}
        onValueChange={(v) => {
          if (!v) return;
          if (v === "other") return setOther(true);
          setOther(false);
          set({ expectedPayday: Number(v), lastSalaryOn: null });
        }}
        aria-label="Payday"
        className="flex-nowrap"
      >
        {PAYDAY_PICKS.map((p) => (
          <ToggleGroupItem key={p.day} value={String(p.day)} className={GROW_CHIP}>
            {p.label}
          </ToggleGroupItem>
        ))}
        <ToggleGroupItem value="other" className={GROW_CHIP}>
          Other
        </ToggleGroupItem>
      </ToggleGroup>
      {other && (
        <Select
          value={String(a.expectedPayday)}
          onValueChange={(v) => set({ expectedPayday: Number(v), lastSalaryOn: null })}
        >
          <SelectTrigger className="bg-card" aria-label="Payday">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
              <SelectItem key={d} value={String(d)}>
                Day {d} of the month
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <label className="ob-inline">
        <span>Last one landed on</span>
        <Input
          className="h-10 w-auto bg-card"
          type="date"
          value={salaryDate(a, today)}
          max={today}
          onChange={(e) => e.target.value && set({ lastSalaryOn: e.target.value })}
        />
      </label>
      {a.salary > 0 && <Reaction>{paydayLine[a.personality]}</Reaction>}
    </>
  );
}

// Step 3
export function Bills({ a, set }: StepProps) {
  const [editing, setEditing] = useState<number | null>(null);
  const total = a.bills.reduce((s, b) => s + b.amount, 0);
  const pct = a.salary ? (total / a.salary) * 100 : 0;
  return (
    <>
      <Head title="What bills hit every month? 🧾" />
      <div className="ob-list">
        {a.bills.map((b, i) =>
          editing === i ? (
            <EditCard key={i}>
              <BillForm
                initial={b}
                onAdd={(v) => (set({ bills: replaceAt(a.bills, i, v) }), setEditing(null))}
                onCancel={() => setEditing(null)}
              />
            </EditCard>
          ) : (
            <ObCard key={i} className="ob-row">
              <span className="ob-row__emoji">{billEmoji(b.name)}</span>
              <span className="ob-row__name">{b.name}</span>
              <span className="ob-row__amount">{formatMoney(b.amount)}</span>
              <RowActions
                onEdit={() => setEditing(i)}
                onRemove={() => (set({ bills: without(a.bills, i) }), setEditing(null))}
                what={b.name}
              />
            </ObCard>
          ),
        )}
        <Adder label="Add a bill">
          {(close) => <BillForm onAdd={(b) => (set({ bills: [...a.bills, b] }), close())} onCancel={close} />}
        </Adder>
      </div>
      <ObCard className="ob-total">
        <span>Total</span>
        <strong>
          {formatMoney(total)} <em>· {Math.round(pct)}%</em>
        </strong>
      </ObCard>
      <Reaction>{billsLine(pct, a.personality)}</Reaction>
    </>
  );
}

function BillForm({ initial, onAdd, onCancel }: FormProps<Answers["bills"][number]>) {
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(initial?.amount ?? 0);
  return (
    <>
      <Input
        className="bg-card"
        placeholder="Electricity, data, cleaner…"
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <MoneyInput className="bg-card" value={amount} onChange={setAmount} aria-label="Bill amount" />
      <FormActions
        disabled={!name.trim() || amount <= 0}
        onAdd={() => onAdd({ name: name.trim(), amount })}
        onCancel={onCancel}
        editing={!!initial}
      />
    </>
  );
}

function FormActions({
  disabled,
  onAdd,
  onCancel,
  editing = false,
}: {
  disabled: boolean;
  onAdd: () => void;
  onCancel: () => void;
  editing?: boolean;
}) {
  return (
    <div className="ob-form__actions">
      <Button variant="muted" size="inline" onClick={onCancel}>
        Cancel
      </Button>
      <Button size="sm" disabled={disabled} onClick={onAdd}>
        {editing ? "Save" : "Add"}
      </Button>
    </div>
  );
}

// Step 4
const monthLabel = (iso: ISODate, today: ISODate) => {
  const [y, m] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1, 1));
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  return d.toLocaleDateString("en-GB", { timeZone: "UTC", month: "long", ...(sameYear ? {} : { year: "numeric" }) });
};

export function BigBills({ a, set, today }: StepProps) {
  const [editing, setEditing] = useState<number | null>(null);
  const start = salaryDate(a, today);
  return (
    <>
      <Head
        title="Anything big coming? 🪣"
        sub="Rent, school fees, annual subscriptions. Anything that isn't monthly."
      />
      <div className="ob-list">
        {a.sinkingFunds.map((f, i) =>
          editing === i ? (
            <EditCard key={i}>
              <FundForm
                today={today}
                initial={f}
                onAdd={(v) => (set({ sinkingFunds: replaceAt(a.sinkingFunds, i, v) }), setEditing(null))}
                onCancel={() => setEditing(null)}
              />
            </EditCard>
          ) : (
            <ObCard key={i} className="ob-fund">
              <div className="ob-fund__top">
                <strong>🏠 {f.name}</strong>
                <strong>{formatMoney(f.target)}</strong>
                <RowActions
                  onEdit={() => setEditing(i)}
                  onRemove={() => (set({ sinkingFunds: without(a.sinkingFunds, i) }), setEditing(null))}
                  what={f.name}
                />
              </div>
              <div className="ob-muted">Due {monthLabel(f.dueDate, today)}</div>
              <div className="ob-setaside">
                We'll set aside{" "}
                {formatMoney(
                  sinkingSetAside(
                    { id: "", name: f.name, target: f.target, saved: 0, due: f.dueDate },
                    start,
                    a.expectedPayday,
                  ),
                )}
                /month for this →
              </div>
            </ObCard>
          ),
        )}
        <Adder label="Add another big bill">
          {(close) => (
            <FundForm
              today={today}
              onAdd={(f) => (set({ sinkingFunds: [...a.sinkingFunds, f] }), close())}
              onCancel={close}
            />
          )}
        </Adder>
      </div>
      <Reaction>{sinkingLine(a.sinkingFunds.length)[a.personality]}</Reaction>
    </>
  );
}

function FundForm({
  today,
  initial,
  onAdd,
  onCancel,
}: FormProps<Answers["sinkingFunds"][number]> & { today: ISODate }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [target, setTarget] = useState(initial?.target ?? 0);
  const [month, setMonth] = useState(initial?.dueDate.slice(0, 7) ?? "");
  return (
    <>
      <Input
        className="bg-card"
        placeholder="Rent, school fees…"
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <MoneyInput className="bg-card" value={target} onChange={setTarget} aria-label="Amount" />
      <label className="ob-inline">
        <span>Due in</span>
        <Input
          className="h-10 w-auto bg-card"
          type="month"
          min={today.slice(0, 7)}
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </label>
      <FormActions
        disabled={!name.trim() || target <= 0 || !month}
        onAdd={() => onAdd({ name: name.trim(), target, dueDate: `${month}-01` })}
        onCancel={onCancel}
        editing={!!initial}
      />
    </>
  );
}

// Step 5
const planLabel = (d: DebtInput) => {
  const p = d.plan;
  if (p.kind === "installments") return `Fixed installments · ${formatMoney(p.perCycle)}/month`;
  if (p.kind === "flexible") return `Flexible · min ${formatMoney(p.min)}`;
  return `One-off · due ${p.due}`;
};

export function Debts({ a, set }: StepProps) {
  const [bulk, setBulk] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  return (
    <>
      <Head title="Let's get honest ⚔️" sub="Every debt or obligation, no judgment here." />
      <div className="ob-list">
        {a.debts.map((d, i) =>
          editing === i ? (
            <EditCard key={i}>
              <DebtForm
                initial={d}
                onAdd={(v) => (set({ debts: replaceAt(a.debts, i, v) }), setEditing(null))}
                onCancel={() => setEditing(null)}
              />
            </EditCard>
          ) : (
            <ObCard key={i} className="ob-debt">
              <div className="ob-debt__top">
                <strong>
                  {creditorEmoji(d.creditor)} {d.name}
                </strong>
                <strong>{formatMoney(d.amountLeft)} left</strong>
                <RowActions
                  onEdit={() => setEditing(i)}
                  onRemove={() => (set({ debts: without(a.debts, i) }), setEditing(null))}
                  what={d.name}
                />
              </div>
              <div className="ob-muted">
                {planLabel(d)}
                {d.hasInterest ? " · interest or penalties" : ""}
              </div>
            </ObCard>
          ),
        )}
        {bulk ? (
          <ObCard className="ob-form">
            <BulkDebtForm
              onAdd={(ds) => (set({ debts: [...a.debts, ...ds] }), setBulk(false))}
              onCancel={() => setBulk(false)}
            />
          </ObCard>
        ) : (
          <ObCard asChild className="ob-shortcut">
            <button type="button" onClick={() => setBulk(true)}>
              ⚡ Shortcut: "I have 8 loan-app loans, ~NGN 45,000 each"
            </button>
          </ObCard>
        )}
        <Adder label="Add a debt">
          {(close) => <DebtForm onAdd={(d) => (set({ debts: [...a.debts, d] }), close())} onCancel={close} />}
        </Adder>
      </div>
      <Reaction>{debtsLine(a.debts.length)}</Reaction>
    </>
  );
}

function DebtForm({ initial, onAdd, onCancel }: FormProps<DebtInput>) {
  const p = initial?.plan;
  const [creditor, setCreditor] = useState<string>(initial?.creditor ?? CREDITORS[0].label);
  const [name, setName] = useState(initial?.name ?? "");
  const [left, setLeft] = useState(initial?.amountLeft ?? 0);
  const [kind, setKind] = useState<DebtInput["plan"]["kind"]>(p?.kind ?? "installments");
  const [perCycle, setPerCycle] = useState(p?.kind === "installments" ? p.perCycle : 0);
  const [min, setMin] = useState(p?.kind === "flexible" ? p.min : 0);
  const [ideal, setIdeal] = useState(p?.kind === "flexible" ? p.ideal : 0);
  const [due, setDue] = useState(p?.kind === "oneOff" ? p.due : "");
  const [interest, setInterest] = useState(initial?.hasInterest ?? false);

  const plan: DebtInput["plan"] | null =
    kind === "installments"
      ? perCycle > 0
        ? { kind, perCycle }
        : null
      : kind === "flexible"
        ? ideal >= min
          ? { kind, min, ideal }
          : null
        : due
          ? { kind, due }
          : null;

  return (
    <>
      <ToggleGroup
        type="single"
        variant="chips"
        value={creditor}
        onValueChange={(v) => v && setCreditor(v)}
        aria-label="Who it's owed to"
      >
        {CREDITORS.map((c) => (
          <ToggleGroupItem key={c.label} value={c.label}>
            {c.emoji} {c.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Input
        className="bg-card"
        placeholder="Who is it? e.g. OPay, Uncle Tunde"
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <Label>Amount left</Label>
      <MoneyInput className="bg-card" value={left} onChange={setLeft} aria-label="Amount left" />
      <ToggleGroup
        type="single"
        value={kind}
        onValueChange={(v) => v && setKind(v as DebtInput["plan"]["kind"])}
        aria-label="Repayment"
        className={SEG}
      >
        <ToggleGroupItem value="installments" className={SEG_ITEM}>
          Fixed monthly
        </ToggleGroupItem>
        <ToggleGroupItem value="flexible" className={SEG_ITEM}>
          Flexible
        </ToggleGroupItem>
        <ToggleGroupItem value="oneOff" className={SEG_ITEM}>
          One-off
        </ToggleGroupItem>
      </ToggleGroup>
      {kind === "installments" && (
        <MoneyInput
          className="bg-card"
          value={perCycle}
          onChange={setPerCycle}
          aria-label="Monthly repayment"
          placeholder="Per month"
        />
      )}
      {kind === "flexible" && (
        <div className="ob-pair">
          <MoneyInput
            className="bg-card"
            value={min}
            onChange={setMin}
            aria-label="Minimum a month"
            placeholder="Min"
          />
          <MoneyInput
            className="bg-card"
            value={ideal}
            onChange={setIdeal}
            aria-label="Ideal a month"
            placeholder="Ideal"
          />
        </div>
      )}
      {kind === "oneOff" && (
        <Input
          className="bg-card"
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          aria-label="Due date"
        />
      )}
      <label className="flex items-center gap-2 text-[13px] font-semibold text-soft">
        <Checkbox checked={interest} onCheckedChange={(v) => setInterest(v === true)} />
        Charges interest or late penalties
      </label>
      <FormActions
        disabled={!name.trim() || left <= 0 || !plan}
        onAdd={() => plan && onAdd({ name: name.trim(), creditor, amountLeft: left, hasInterest: interest, plan })}
        onCancel={onCancel}
        editing={!!initial}
      />
    </>
  );
}

function BulkDebtForm({ onAdd, onCancel }: { onAdd: (d: DebtInput[]) => void; onCancel: () => void }) {
  const [count, setCount] = useState(2);
  const [each, setEach] = useState(0);
  const [perCycle, setPerCycle] = useState(0);
  return (
    <>
      <Label>How many similar loans?</Label>
      <Input
        className="bg-card"
        type="number"
        min={2}
        max={30}
        value={count}
        onChange={(e) => setCount(Math.max(2, Math.min(30, Number(e.target.value) || 2)))}
      />
      <Label>About how much left on each?</Label>
      <MoneyInput className="bg-card" value={each} onChange={setEach} aria-label="Amount left on each" />
      <Label>Monthly repayment on each</Label>
      <MoneyInput className="bg-card" value={perCycle} onChange={setPerCycle} aria-label="Monthly repayment on each" />
      <FormActions
        disabled={each <= 0 || perCycle <= 0}
        onAdd={() =>
          onAdd(
            Array.from({ length: count }, (_, i) => ({
              name: `Loan app #${i + 1}`,
              creditor: "Loan app",
              amountLeft: each,
              hasInterest: true,
              plan: { kind: "installments", perCycle },
            })),
          )
        }
        onCancel={onCancel}
      />
    </>
  );
}

// Step 6
const GOAL_EMOJI = ["✈️", "💻", "🏠", "🚗", "🎓", "💍", "🎯"];

export function Goals({ a, set }: StepProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const done = () => setEditing(null);
  return (
    <>
      <Head title="What are you working toward? 🎯" />
      <div className="ob-list">
        {a.goals.map((g, i) =>
          editing === `g${i}` ? (
            <EditCard key={`g${i}`}>
              <GoalForm
                initial={{ kind: "goal", goal: g }}
                onGoal={(v) => (set({ goals: replaceAt(a.goals, i, v) }), done())}
                onPerson={() => {}}
                onCancel={done}
              />
            </EditCard>
          ) : (
            <ObCard key={`g${i}`} className="ob-goal">
              <div className="ob-debt__top">
                <strong>
                  {g.emoji} {g.name}
                </strong>
                <RowActions
                  onEdit={() => setEditing(`g${i}`)}
                  onRemove={() => (set({ goals: without(a.goals, i) }), done())}
                  what={g.name}
                />
              </div>
              <div className="ob-muted">Target {formatMoney(g.target)}</div>
            </ObCard>
          ),
        )}
        {a.commitments.map((c, i) =>
          editing === `c${i}` ? (
            <EditCard key={`c${i}`}>
              <GoalForm
                initial={{ kind: "person", person: c }}
                onGoal={() => {}}
                onPerson={(v) => (set({ commitments: replaceAt(a.commitments, i, v) }), done())}
                onCancel={done}
              />
            </EditCard>
          ) : (
            <ObCard key={`c${i}`} className="ob-goal">
              <div className="ob-debt__top">
                <strong>👤 {c.name}</strong>
                <RowActions
                  onEdit={() => setEditing(`c${i}`)}
                  onRemove={() => (set({ commitments: without(a.commitments, i) }), done())}
                  what={c.name}
                />
              </div>
              <div className="ob-minideal">
                <div>
                  <span>MIN</span>
                  {formatMoney(c.min)}
                </div>
                <div className="is-ideal">
                  <span>IDEAL</span>
                  {formatMoney(c.ideal)}
                </div>
              </div>
            </ObCard>
          ),
        )}
        <Adder label="Add a goal or person">
          {(close) => (
            <GoalForm
              onGoal={(g) => (set({ goals: [...a.goals, g] }), close())}
              onPerson={(p) => (set({ commitments: [...a.commitments, p] }), close())}
              onCancel={close}
            />
          )}
        </Adder>
      </div>
      <Reaction>{goalsLine(a.goals.length + a.commitments.length)[a.personality]}</Reaction>
    </>
  );
}

const SEG = "rounded-field p-1";
const SEG_ITEM = "flex-1 rounded-[9px] px-1.5 py-2";

type GoalInitial =
  { kind: "goal"; goal: Answers["goals"][number] } | { kind: "person"; person: Answers["commitments"][number] };

function GoalForm({
  initial,
  onGoal,
  onPerson,
  onCancel,
}: {
  initial?: GoalInitial;
  onGoal: (g: Answers["goals"][number]) => void;
  onPerson: (p: Answers["commitments"][number]) => void;
  onCancel: () => void;
}) {
  const goal = initial?.kind === "goal" ? initial.goal : undefined;
  const person = initial?.kind === "person" ? initial.person : undefined;
  const [kind, setKind] = useState<"goal" | "person">(initial?.kind ?? "goal");
  const [name, setName] = useState(goal?.name ?? person?.name ?? "");
  const [emoji, setEmoji] = useState(goal?.emoji ?? GOAL_EMOJI[0]!);
  const [target, setTarget] = useState(goal?.target ?? 0);
  const [min, setMin] = useState(person?.min ?? 0);
  const [ideal, setIdeal] = useState(person?.ideal ?? 0);
  return (
    <>
      {!initial && (
        <ToggleGroup
          type="single"
          value={kind}
          onValueChange={(v) => v && setKind(v as "goal" | "person")}
          aria-label="What to add"
          className={SEG}
        >
          <ToggleGroupItem value="goal" className={SEG_ITEM}>
            🎯 A goal
          </ToggleGroupItem>
          <ToggleGroupItem value="person" className={SEG_ITEM}>
            👤 Someone I support
          </ToggleGroupItem>
        </ToggleGroup>
      )}
      {kind === "goal" && (
        <ToggleGroup
          type="single"
          variant="chips"
          value={emoji}
          onValueChange={(v) => v && setEmoji(v)}
          aria-label="Goal emoji"
        >
          {GOAL_EMOJI.map((e) => (
            <ToggleGroupItem key={e} value={e} aria-label={e} className="px-2.5 py-2 text-lg">
              {e}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
      <Input
        className="bg-card"
        placeholder={kind === "goal" ? "Japa fund, new laptop…" : "Sister, mum…"}
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      {kind === "goal" ? (
        <MoneyInput className="bg-card" value={target} onChange={setTarget} aria-label="Target" placeholder="Target" />
      ) : (
        <div className="ob-pair">
          <MoneyInput
            className="bg-card"
            value={min}
            onChange={setMin}
            aria-label="Minimum a month"
            placeholder="Min"
          />
          <MoneyInput
            className="bg-card"
            value={ideal}
            onChange={setIdeal}
            aria-label="Ideal a month"
            placeholder="Ideal"
          />
        </div>
      )}
      <FormActions
        disabled={!name.trim() || (kind === "goal" ? target <= 0 : ideal < min || ideal <= 0)}
        onAdd={() =>
          kind === "goal" ? onGoal({ name: name.trim(), emoji, target }) : onPerson({ name: name.trim(), min, ideal })
        }
        onCancel={onCancel}
        editing={!!initial}
      />
    </>
  );
}

// Step 7
export function Everyday({ a, set }: StepProps) {
  return (
    <>
      <Head title="Food, transport, daily stuff? 🍜" sub="A rough monthly guess is fine." />
      <MoneyInput
        className={`ob-money ${a.discovery ? "is-dim" : ""}`}
        value={a.everydayEstimate}
        onChange={(everydayEstimate) => set({ everydayEstimate, discovery: false })}
        aria-label="Everyday spending a month"
      />
      <Toggle
        variant="tiles"
        pressed={a.discovery}
        onPressedChange={(discovery) => set({ discovery })}
        className="justify-items-center gap-1 rounded-[14px] border-primary bg-transparent p-4 text-center data-[state=on]:border-primary data-[state=on]:bg-accent"
      >
        <strong className="text-[15px] font-extrabold text-accent-foreground">🔍 No idea</strong>
        <span className="text-xs font-semibold text-soft">
          Starts a Discovery cycle: one month of just logging, no judgment.
        </span>
      </Toggle>
      {(a.discovery || a.everydayEstimate > 0) && <Reaction>{everydayLine(a.discovery)[a.personality]}</Reaction>}
    </>
  );
}

// Step 8
const LEAKS: { key: OnboardingInput["leakCategories"][number]; label: string }[] = [
  { key: "food", label: "🍜 Food" },
  { key: "drinks", label: "🍻 Drinks & smokes" },
  { key: "transport", label: "🚌 Transport" },
  { key: "treating", label: "🎁 Treating others" },
  { key: "impulse", label: "🛍️ Impulse shopping" },
];
const TIMES: { key: OnboardingInput["overspendTimes"][number]; label: string }[] = [
  { key: "afterPayday", label: "💸 Right after payday" },
  { key: "weekends", label: "🎉 Weekends" },
  { key: "monthEnd", label: "📆 Month end" },
];

export function Leaks({ a, set }: StepProps) {
  return (
    <>
      <Head title="Where does money leak? 🕳️" />
      <ToggleGroup
        type="multiple"
        variant="chips"
        value={a.leakCategories}
        onValueChange={(v) => set({ leakCategories: v as Answers["leakCategories"] })}
        aria-label="Where money leaks"
      >
        {LEAKS.map((l) => (
          <ToggleGroupItem key={l.key} value={l.key} className="bg-card">
            {l.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="ob-subhead">When does it usually happen?</div>
      <ToggleGroup
        type="multiple"
        variant="chips"
        value={a.overspendTimes}
        onValueChange={(v) => set({ overspendTimes: v as Answers["overspendTimes"] })}
        aria-label="When it happens"
      >
        {TIMES.map((l) => (
          <ToggleGroupItem key={l.key} value={l.key} className="bg-card">
            {l.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {a.overspendTimes.includes("afterPayday") && (
        <div className="ob-reaction ob-paydaymode">
          <strong>💸 Payday mode switched on</strong>
          <span>"{paydayModeSample}"</span>
        </div>
      )}
    </>
  );
}

// Step 9 (dark)
const CHECKINS: { key: OnboardingInput["checkinMethod"]; title: string; sub?: string }[] = [
  { key: "evening", title: "🌙 Evening check-in", sub: "A gentle nudge + quick log card each evening" },
  { key: "drift", title: "📉 Drift alerts", sub: "Only when you're falling behind pace" },
  { key: "app", title: "🤐 Just let me open the app" },
];

export function OnTrack({ a, set }: StepProps) {
  return (
    <>
      <Head title="How should I keep you honest? 🌙" />
      <ToggleGroup
        type="single"
        variant="tiles"
        value={a.checkinMethod}
        onValueChange={(v) => v && set({ checkinMethod: v as Answers["checkinMethod"] })}
        aria-label="Check-ins"
      >
        {CHECKINS.map((c) => (
          <ToggleGroupItem key={c.key} value={c.key}>
            <strong className="text-sm font-bold">{c.title}</strong>
            {c.sub && <span className="text-xs font-semibold text-muted-foreground">{c.sub}</span>}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="ob-subhead">Weekly leftovers should go to…</div>
      <ToggleGroup
        type="single"
        variant="tiles"
        value={a.leftoverDefault}
        onValueChange={(v) => v && set({ leftoverDefault: v as Answers["leftoverDefault"] })}
        aria-label="Weekly leftovers"
        className="grid grid-cols-2"
      >
        <ToggleGroupItem value="debts" className="justify-items-center text-center">
          <strong className="text-sm font-bold">⚔️ Debts first</strong>
        </ToggleGroupItem>
        <ToggleGroupItem value="savings" className="justify-items-center text-center">
          <strong className="text-sm font-bold">🌱 Savings first</strong>
        </ToggleGroupItem>
      </ToggleGroup>
    </>
  );
}
