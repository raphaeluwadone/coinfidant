import {
  computeOpenCycle,
  detectPhase,
  formatMoney,
  hasEvent,
  type ISODate,
  PHASES,
  REVEAL_TAGLINE,
} from "@coinfidant/engine";
import { useMemo } from "react";
import { type Answers, previewInput } from "./state";

type Props = {
  a: Answers;
  today: ISODate;
  saving: boolean;
  error: boolean;
  onConfirm: () => void;
  onAdjust: () => void;
};

export function usePlanPreview(a: Answers, today: ISODate) {
  return useMemo(() => {
    const input = previewInput(a, today);
    const open = computeOpenCycle(input);
    return { open, reading: detectPhase(input, open) };
  }, [a, today]);
}

export function Reveal({ a, today, saving, error, onConfirm, onAdjust }: Props) {
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

      <div className="ob-reveal__foot">
        {error && (
          <p className="ob-reveal__error" role="alert">
            That didn't save. Check your connection and try again.
          </p>
        )}
        <button className="btn ob-reveal__cta" onClick={onConfirm} disabled={saving || overcommitted}>
          Looks good, let's go
        </button>
        <button className="link-btn ob-reveal__adjust" onClick={onAdjust}>
          Adjust the plan
        </button>
        <div className="ob-reveal__tagline">{REVEAL_TAGLINE}</div>
      </div>
    </div>
  );
}
