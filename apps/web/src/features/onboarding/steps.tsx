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
} from "@coinfidant/engine";
import { type ReactNode, useState } from "react";
import { MoneyInput } from "../../components/MoneyInput";
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

const Remove = ({ onClick, what }: { onClick: () => void; what: string }) => (
  <button type="button" className="ob-remove" onClick={onClick} aria-label={`Remove ${what}`}>
    ✕
  </button>
);

function Adder({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className="ob-add" onClick={() => setOpen(true)}>
        + {label}
      </button>
    );
  return <div className="ob-card ob-form">{children(() => setOpen(false))}</div>;
}

const without = <T,>(list: T[], i: number) => list.filter((_, k) => k !== i);

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
      <div className="ob-dial" role="radiogroup" aria-label="Personality">
        {TONES.map((t) => (
          <button
            key={t.key}
            type="button"
            role="radio"
            aria-checked={a.personality === t.key}
            className={`ob-dial__opt ${a.personality === t.key ? "is-on" : ""}`}
            onClick={() => set({ personality: t.key })}
          >
            <span className="ob-dial__emoji">{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>
      <div className="ob-card ob-preview">"{sweepPreview(4_200_00)[a.personality]}"</div>
    </div>
  );
}

// Step 2
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
      <div className="ob-chips">
        {PAYDAY_PICKS.map((p) => (
          <button
            key={p.day}
            type="button"
            className={`ob-chip ob-chip--grow ${!other && a.expectedPayday === p.day ? "is-on" : ""}`}
            onClick={() => {
              setOther(false);
              set({ expectedPayday: p.day, lastSalaryOn: null });
            }}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          className={`ob-chip ob-chip--grow ${other ? "is-on" : ""}`}
          onClick={() => setOther(true)}
        >
          Other
        </button>
      </div>
      {other && (
        <select
          className="select ob-select"
          value={a.expectedPayday}
          onChange={(e) => set({ expectedPayday: Number(e.target.value), lastSalaryOn: null })}
          aria-label="Payday"
        >
          {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              Day {d} of the month
            </option>
          ))}
        </select>
      )}
      <label className="ob-inline">
        <span>Last one landed on</span>
        <input
          className="text-input"
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
  const total = a.bills.reduce((s, b) => s + b.amount, 0);
  const pct = a.salary ? (total / a.salary) * 100 : 0;
  return (
    <>
      <Head title="What bills hit every month? 🧾" />
      <div className="ob-list">
        {a.bills.map((b, i) => (
          <div key={i} className="ob-card ob-row">
            <span className="ob-row__emoji">{billEmoji(b.name)}</span>
            <span className="ob-row__name">{b.name}</span>
            <span className="ob-row__amount">{formatMoney(b.amount)}</span>
            <Remove onClick={() => set({ bills: without(a.bills, i) })} what={b.name} />
          </div>
        ))}
        <Adder label="Add a bill">
          {(close) => <BillForm onAdd={(b) => (set({ bills: [...a.bills, b] }), close())} onCancel={close} />}
        </Adder>
      </div>
      <div className="ob-card ob-total">
        <span>Total</span>
        <strong>
          {formatMoney(total)} <em>· {Math.round(pct)}%</em>
        </strong>
      </div>
      <Reaction>{billsLine(pct, a.personality)}</Reaction>
    </>
  );
}

function BillForm({ onAdd, onCancel }: { onAdd: (b: Answers["bills"][number]) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(0);
  return (
    <>
      <input
        className="text-input"
        placeholder="Electricity, data, cleaner…"
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <MoneyInput value={amount} onChange={setAmount} aria-label="Bill amount" />
      <FormActions
        disabled={!name.trim() || amount <= 0}
        onAdd={() => onAdd({ name: name.trim(), amount })}
        onCancel={onCancel}
      />
    </>
  );
}

function FormActions({ disabled, onAdd, onCancel }: { disabled: boolean; onAdd: () => void; onCancel: () => void }) {
  return (
    <div className="ob-form__actions">
      <button type="button" className="link-btn ob-form__cancel" onClick={onCancel}>
        Cancel
      </button>
      <button type="button" className="btn ob-form__add" disabled={disabled} onClick={onAdd}>
        Add
      </button>
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
  const start = salaryDate(a, today);
  return (
    <>
      <Head
        title="Anything big coming? 🪣"
        sub="Rent, school fees, annual subscriptions. Anything that isn't monthly."
      />
      <div className="ob-list">
        {a.sinkingFunds.map((f, i) => (
          <div key={i} className="ob-card ob-fund">
            <div className="ob-fund__top">
              <strong>🏠 {f.name}</strong>
              <strong>{formatMoney(f.target)}</strong>
              <Remove onClick={() => set({ sinkingFunds: without(a.sinkingFunds, i) })} what={f.name} />
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
          </div>
        ))}
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
  onAdd,
  onCancel,
}: {
  today: ISODate;
  onAdd: (f: Answers["sinkingFunds"][number]) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState(0);
  const [month, setMonth] = useState("");
  return (
    <>
      <input
        className="text-input"
        placeholder="Rent, school fees…"
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <MoneyInput value={target} onChange={setTarget} aria-label="Amount" />
      <label className="ob-inline">
        <span>Due in</span>
        <input
          className="text-input"
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
  return (
    <>
      <Head title="Let's get honest ⚔️" sub="Every debt or obligation, no judgment here." />
      <div className="ob-list">
        {a.debts.map((d, i) => (
          <div key={i} className="ob-card ob-debt">
            <div className="ob-debt__top">
              <strong>
                {creditorEmoji(d.creditor)} {d.name}
              </strong>
              <strong>{formatMoney(d.amountLeft)} left</strong>
              <Remove onClick={() => set({ debts: without(a.debts, i) })} what={d.name} />
            </div>
            <div className="ob-muted">
              {planLabel(d)}
              {d.hasInterest ? " · interest or penalties" : ""}
            </div>
          </div>
        ))}
        {bulk ? (
          <div className="ob-card ob-form">
            <BulkDebtForm
              onAdd={(ds) => (set({ debts: [...a.debts, ...ds] }), setBulk(false))}
              onCancel={() => setBulk(false)}
            />
          </div>
        ) : (
          <button type="button" className="ob-card ob-shortcut" onClick={() => setBulk(true)}>
            ⚡ Shortcut: "I have 8 loan-app loans, ~NGN 45,000 each"
          </button>
        )}
        <Adder label="Add a debt">
          {(close) => <DebtForm onAdd={(d) => (set({ debts: [...a.debts, d] }), close())} onCancel={close} />}
        </Adder>
      </div>
      <Reaction>{debtsLine(a.debts.length)}</Reaction>
    </>
  );
}

function DebtForm({ onAdd, onCancel }: { onAdd: (d: DebtInput) => void; onCancel: () => void }) {
  const [creditor, setCreditor] = useState<string>(CREDITORS[0].label);
  const [name, setName] = useState("");
  const [left, setLeft] = useState(0);
  const [kind, setKind] = useState<DebtInput["plan"]["kind"]>("installments");
  const [perCycle, setPerCycle] = useState(0);
  const [min, setMin] = useState(0);
  const [ideal, setIdeal] = useState(0);
  const [due, setDue] = useState("");
  const [interest, setInterest] = useState(false);

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
      <div className="ob-chips">
        {CREDITORS.map((c) => (
          <button
            key={c.label}
            type="button"
            className={`ob-chip ${creditor === c.label ? "is-on" : ""}`}
            onClick={() => setCreditor(c.label)}
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>
      <input
        className="text-input"
        placeholder="Who is it? e.g. OPay, Uncle Tunde"
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <Label>Amount left</Label>
      <MoneyInput value={left} onChange={setLeft} aria-label="Amount left" />
      <div className="ob-seg" role="radiogroup" aria-label="Repayment">
        {(
          [
            ["installments", "Fixed monthly"],
            ["flexible", "Flexible"],
            ["oneOff", "One-off"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            className={kind === k ? "is-on" : ""}
            onClick={() => setKind(k)}
          >
            {label}
          </button>
        ))}
      </div>
      {kind === "installments" && (
        <MoneyInput value={perCycle} onChange={setPerCycle} aria-label="Monthly repayment" placeholder="Per month" />
      )}
      {kind === "flexible" && (
        <div className="ob-pair">
          <MoneyInput value={min} onChange={setMin} aria-label="Minimum a month" placeholder="Min" />
          <MoneyInput value={ideal} onChange={setIdeal} aria-label="Ideal a month" placeholder="Ideal" />
        </div>
      )}
      {kind === "oneOff" && (
        <input
          className="text-input"
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          aria-label="Due date"
        />
      )}
      <label className="ob-check">
        <input type="checkbox" checked={interest} onChange={(e) => setInterest(e.target.checked)} />
        Charges interest or late penalties
      </label>
      <FormActions
        disabled={!name.trim() || left <= 0 || !plan}
        onAdd={() => plan && onAdd({ name: name.trim(), creditor, amountLeft: left, hasInterest: interest, plan })}
        onCancel={onCancel}
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
      <input
        className="text-input"
        type="number"
        min={2}
        max={30}
        value={count}
        onChange={(e) => setCount(Math.max(2, Math.min(30, Number(e.target.value) || 2)))}
      />
      <Label>About how much left on each?</Label>
      <MoneyInput value={each} onChange={setEach} aria-label="Amount left on each" />
      <Label>Monthly repayment on each</Label>
      <MoneyInput value={perCycle} onChange={setPerCycle} aria-label="Monthly repayment on each" />
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
  return (
    <>
      <Head title="What are you working toward? 🎯" />
      <div className="ob-list">
        {a.goals.map((g, i) => (
          <div key={`g${i}`} className="ob-card ob-goal">
            <div className="ob-debt__top">
              <strong>
                {g.emoji} {g.name}
              </strong>
              <Remove onClick={() => set({ goals: without(a.goals, i) })} what={g.name} />
            </div>
            <div className="ob-muted">Target {formatMoney(g.target)}</div>
          </div>
        ))}
        {a.commitments.map((c, i) => (
          <div key={`c${i}`} className="ob-card ob-goal">
            <div className="ob-debt__top">
              <strong>👤 {c.name}</strong>
              <Remove onClick={() => set({ commitments: without(a.commitments, i) })} what={c.name} />
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
          </div>
        ))}
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

function GoalForm({
  onGoal,
  onPerson,
  onCancel,
}: {
  onGoal: (g: Answers["goals"][number]) => void;
  onPerson: (p: Answers["commitments"][number]) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<"goal" | "person">("goal");
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(GOAL_EMOJI[0]!);
  const [target, setTarget] = useState(0);
  const [min, setMin] = useState(0);
  const [ideal, setIdeal] = useState(0);
  return (
    <>
      <div className="ob-seg" role="radiogroup" aria-label="What to add">
        <button
          type="button"
          role="radio"
          aria-checked={kind === "goal"}
          className={kind === "goal" ? "is-on" : ""}
          onClick={() => setKind("goal")}
        >
          🎯 A goal
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={kind === "person"}
          className={kind === "person" ? "is-on" : ""}
          onClick={() => setKind("person")}
        >
          👤 Someone I support
        </button>
      </div>
      {kind === "goal" && (
        <div className="ob-chips">
          {GOAL_EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              className={`ob-chip ob-chip--emoji ${emoji === e ? "is-on" : ""}`}
              onClick={() => setEmoji(e)}
              aria-label={e}
            >
              {e}
            </button>
          ))}
        </div>
      )}
      <input
        className="text-input"
        placeholder={kind === "goal" ? "Japa fund, new laptop…" : "Sister, mum…"}
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      {kind === "goal" ? (
        <MoneyInput value={target} onChange={setTarget} aria-label="Target" placeholder="Target" />
      ) : (
        <div className="ob-pair">
          <MoneyInput value={min} onChange={setMin} aria-label="Minimum a month" placeholder="Min" />
          <MoneyInput value={ideal} onChange={setIdeal} aria-label="Ideal a month" placeholder="Ideal" />
        </div>
      )}
      <FormActions
        disabled={!name.trim() || (kind === "goal" ? target <= 0 : ideal < min || ideal <= 0)}
        onAdd={() =>
          kind === "goal" ? onGoal({ name: name.trim(), emoji, target }) : onPerson({ name: name.trim(), min, ideal })
        }
        onCancel={onCancel}
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
      <button
        type="button"
        className={`ob-noidea ${a.discovery ? "is-on" : ""}`}
        aria-pressed={a.discovery}
        onClick={() => set({ discovery: !a.discovery })}
      >
        <strong>🔍 No idea</strong>
        <span>Starts a Discovery cycle: one month of just logging, no judgment.</span>
      </button>
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
const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export function Leaks({ a, set }: StepProps) {
  return (
    <>
      <Head title="Where does money leak? 🕳️" />
      <div className="ob-chips ob-chips--wrap">
        {LEAKS.map((l) => (
          <button
            key={l.key}
            type="button"
            aria-pressed={a.leakCategories.includes(l.key)}
            className={`ob-chip ${a.leakCategories.includes(l.key) ? "is-on" : ""}`}
            onClick={() => set({ leakCategories: toggle(a.leakCategories, l.key) })}
          >
            {l.label}
          </button>
        ))}
      </div>
      <div className="ob-subhead">When does it usually happen?</div>
      <div className="ob-chips ob-chips--wrap">
        {TIMES.map((l) => (
          <button
            key={l.key}
            type="button"
            aria-pressed={a.overspendTimes.includes(l.key)}
            className={`ob-chip ${a.overspendTimes.includes(l.key) ? "is-on" : ""}`}
            onClick={() => set({ overspendTimes: toggle(a.overspendTimes, l.key) })}
          >
            {l.label}
          </button>
        ))}
      </div>
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
      <div className="ob-list" role="radiogroup" aria-label="Check-ins">
        {CHECKINS.map((c) => (
          <button
            key={c.key}
            type="button"
            role="radio"
            aria-checked={a.checkinMethod === c.key}
            className={`ob-option ${a.checkinMethod === c.key ? "is-on" : ""}`}
            onClick={() => set({ checkinMethod: c.key })}
          >
            <strong>{c.title}</strong>
            {c.sub && <span>{c.sub}</span>}
          </button>
        ))}
      </div>
      <div className="ob-subhead">Weekly leftovers should go to…</div>
      <div className="ob-pair" role="radiogroup" aria-label="Weekly leftovers">
        {(
          [
            ["debts", "⚔️ Debts first"],
            ["savings", "🌱 Savings first"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={a.leftoverDefault === k}
            className={`ob-option ob-option--center ${a.leftoverDefault === k ? "is-on" : ""}`}
            onClick={() => set({ leftoverDefault: k })}
          >
            <strong>{label}</strong>
          </button>
        ))}
      </div>
    </>
  );
}
