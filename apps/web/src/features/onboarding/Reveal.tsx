import {
  computeOpenCycle,
  detectPhase,
  formatMoney,
  hasEvent,
  type ISODate,
  PHASES,
  REVEAL_TAGLINE,
  TONES,
} from "@coinfidant/engine";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { type Answers, previewInput } from "./state";

type Props = {
  a: Answers;
  today: ISODate;
  saving: boolean;
  error: boolean;
  onConfirm: () => void;
  /** Jumps to an onboarding step; its Continue then comes straight back here. */
  onEdit: (step: number) => void;
};

export function usePlanPreview(a: Answers, today: ISODate) {
  return useMemo(() => {
    const input = previewInput(a, today);
    const open = computeOpenCycle(input);
    return { open, reading: detectPhase(input, open) };
  }, [a, today]);
}

const count = (n: number, one: string, many = `${one}s`) => (n ? `${n} ${n === 1 ? one : many}` : "None");
const sum = (xs: number[]) => xs.reduce((t, x) => t + x, 0);

function answerRows(a: Answers) {
  const tone = TONES.find((t) => t.key === a.personality)!;
  const payday = a.expectedPayday === 31 ? "31st / 1st" : `the ${a.expectedPayday}${ordinal(a.expectedPayday)}`;
  return [
    { step: 1, label: "Sass", value: `${tone.emoji} ${tone.label}` },
    { step: 2, label: "Salary", value: `${formatMoney(a.salary)}, lands ${payday}` },
    {
      step: 3,
      label: "Monthly bills",
      value: a.bills.length
        ? `${count(a.bills.length, "bill")} · ${formatMoney(sum(a.bills.map((b) => b.amount)))}`
        : "None",
    },
    { step: 4, label: "Big bills", value: count(a.sinkingFunds.length, "fund") },
    {
      step: 5,
      label: "Debts",
      value: a.debts.length
        ? `${count(a.debts.length, "debt")} · ${formatMoney(sum(a.debts.map((d) => d.amountLeft)))} left`
        : "None",
    },
    {
      step: 6,
      label: "Goals and people",
      value:
        a.goals.length || a.commitments.length
          ? [
              a.goals.length && count(a.goals.length, "goal"),
              a.commitments.length && count(a.commitments.length, "person", "people"),
            ]
              .filter(Boolean)
              .join(", ")
          : "None",
    },
    {
      step: 7,
      label: "Everyday spending",
      value: a.discovery ? "Learning it this cycle 🔍" : `${formatMoney(a.everydayEstimate)}/month`,
    },
    {
      step: 8,
      label: "Leaks and danger zones",
      value:
        a.leakCategories.length + a.overspendTimes.length
          ? count(a.leakCategories.length + a.overspendTimes.length, "pick")
          : "None",
    },
    {
      step: 9,
      label: "Check-ins",
      value: { evening: "Evening check-in", drift: "Drift alerts", app: "App only" }[a.checkinMethod],
    },
  ];
}

const ordinal = (n: number) =>
  n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th";

export function Reveal({ a, today, saving, error, onConfirm, onEdit }: Props) {
  const { open, reading } = usePlanPreview(a, today);
  const phase = PHASES.find((p) => p.key === reading.phase)!;
  const next = PHASES.find((p) => p.key === reading.next);
  const daily = Math.floor(open.plan.flexible / open.cycle.days);
  const overcommitted = hasEvent(open, "overcommitted");

  const priorities = [
    "Essentials",
    a.sinkingFunds.length === 1 ? `${a.sinkingFunds[0]!.name} fund` : a.sinkingFunds.length ? "Big-bill funds" : null,
    a.debts.length ? "Every minimum, on time" : null,
    a.debts.length ? "Extra → most expensive debt" : null,
    a.goals.length || a.commitments.length || !a.debts.length ? "Goals" : null,
  ].filter(Boolean) as string[];

  const unlock = reading.unlocksAround
    ? new Date(`${reading.unlocksAround}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", month: "long" })
    : null;

  return (
    <div className="ob-reveal">
      <div className="ob-confetti" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <i key={i} style={{ left: `${8 + i * 7.5}%`, animationDelay: `${(i % 4) * 0.4}s` }} />
        ))}
      </div>

      <div className="ob-reveal__badge">
        <div className="ob-reveal__emoji">{phase.emoji}</div>
        <div className="ob-reveal__phase">YOU'RE IN {phase.label.toUpperCase()}</div>
        <div className="ob-reveal__meaning">{phase.meaning}</div>
      </div>

      <div className="ob-journey" aria-label={`Phase ${phase.label}`}>
        {PHASES.map((p, i) => (
          <div key={p.key} className="ob-journey__step">
            {i > 0 && <span className="ob-journey__line" />}
            <span className={`ob-journey__node ${p.key === phase.key ? "is-current" : ""}`}>{p.emoji}</span>
          </div>
        ))}
      </div>
      <div className="ob-journey__caption">
        {next
          ? unlock
            ? `${next.label} unlocks around ${unlock}`
            : `${next.label} comes next`
          : "Nothing to hunt. Time to grow."}
      </div>

      {overcommitted ? (
        <div className="ob-reveal__card">
          <div className="ob-reveal__label">HEADS UP</div>
          <p className="ob-reveal__warn">
            Your bills, set-asides and minimums add up to more than your pay. Let's adjust the plan so there's room to
            live.
          </p>
        </div>
      ) : (
        <>
          <div className="ob-reveal__card">
            <div className="ob-reveal__label">YOUR PRIORITY ORDER</div>
            <ol className="ob-reveal__list">
              {priorities.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
          </div>
          <div className="ob-reveal__card ob-reveal__safe">
            <div className="ob-reveal__label">SAFE TO SPEND</div>
            <div className="ob-reveal__amount">
              {formatMoney(daily)}
              <span>/day</span>
            </div>
            <div className="ob-reveal__week">{formatMoney(daily * 7)}/week</div>
          </div>
        </>
      )}

      <div className="ob-reveal__card">
        <div className="ob-reveal__label">YOUR ANSWERS</div>
        <ul className="ob-answers">
          {answerRows(a).map((row) => (
            <li key={row.step}>
              <button type="button" className="ob-answers__row" onClick={() => onEdit(row.step)}>
                <span className="ob-answers__label">{row.label}</span>
                <span className="ob-answers__value">{row.value}</span>
                <span className="ob-answers__edit" aria-hidden="true">
                  Edit ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="ob-reveal__foot">
        {error && (
          <p className="ob-reveal__error" role="alert">
            That didn't save. Check your connection and try again.
          </p>
        )}
        <Button
          className="w-full bg-[var(--ph-accent)] font-extrabold text-[var(--ph-bg)] hover:bg-[var(--ph-text)]"
          onClick={onConfirm}
          disabled={saving || overcommitted}
        >
          Looks good, let's go
        </Button>
        <Button
          variant="muted"
          size="inline"
          className="justify-self-center text-[13px] text-[var(--ph-muted)]"
          onClick={() => onEdit(2)}
        >
          Adjust the plan
        </Button>
        <div className="ob-reveal__tagline">{REVEAL_TAGLINE}</div>
      </div>
    </div>
  );
}
