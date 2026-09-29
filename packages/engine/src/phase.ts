import { addMonths } from "./date";
import type { ISODate } from "./date";
import type { Debt, EngineInput, OpenCycle } from "./types";

export type Phase = "stabilise" | "attack" | "build";

export const PHASES: { key: Phase; label: string; emoji: string; meaning: string }[] = [
  { key: "stabilise", label: "Stabilise", emoji: "🛟", meaning: "First we stop the bleeding." },
  { key: "attack", label: "Attack", emoji: "⚔️", meaning: "Hunt the debts down." },
  { key: "build", label: "Build", emoji: "🌱", meaning: "Grow the future." },
];

type Rankable = Pick<Debt, "id" | "amountLeft" | "hasInterest" | "aprBp">;
const active = <T extends Rankable>(debts: T[]) => debts.filter((d) => d.amountLeft > 0);

/** R22: interest-bearing first, the highest known APR first among those, then the smallest balance (snowball). */
export function attackOrder<T extends Rankable>(debts: T[]): T[] {
  const apr = (d: T) => (d.hasInterest ? (d.aprBp ?? 0) : 0);
  return active(debts).sort(
    (a, b) =>
      Number(b.hasInterest) - Number(a.hasInterest) ||
      apr(b) - apr(a) ||
      a.amountLeft - b.amountLeft ||
      a.id.localeCompare(b.id),
  );
}

export type PhaseReading = {
  phase: Phase;
  next: Phase | null;
  /** Rough month the next phase unlocks, from the current repayment pace; null when there's no pace to project. */
  unlocksAround: ISODate | null;
};

/** R23 */
export function detectPhase(
  input: Pick<EngineInput, "debts" | "cycle">,
  open: Pick<OpenCycle, "plan" | "events">,
): PhaseReading {
  const debts = active(input.debts);
  if (!debts.length) return { phase: "build", next: null, unlocksAround: null };

  const squeezed = open.events.some((e) => e.type === "overcommitted" || e.type === "tight");

  const due = (d: Debt) => open.plan.debts.find((x) => x.id === d.id)?.due ?? 0;
  const cyclesToClear = debts.filter((d) => due(d) > 0).map((d) => Math.ceil(d.amountLeft / due(d)));

  if (squeezed) {
    const first = cyclesToClear.length ? Math.min(...cyclesToClear) : null;
    return { phase: "stabilise", next: "attack", unlocksAround: first ? addMonths(input.cycle.start, first) : null };
  }

  const totalDue = debts.reduce((a, d) => a + due(d), 0);
  const totalLeft = debts.reduce((a, d) => a + d.amountLeft, 0);
  const cycles = totalDue > 0 ? Math.ceil(totalLeft / totalDue) : null;
  return { phase: "attack", next: "build", unlocksAround: cycles ? addMonths(input.cycle.start, cycles) : null };
}
