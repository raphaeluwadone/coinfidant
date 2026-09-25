import { laterPaydays } from "./calendar";
import { attackOrder } from "./phase";
import type { ISODate } from "./date";
import type { Minor } from "./money";
import type { Debt, EngineEvent, EngineInput, PlanBreakdown, Suggestion } from "./types";

const TIGHT_RATIO = 0.1;

/** R5 */
export function debtDue(d: Debt, start: ISODate, end: ISODate): Minor {
  const left = Math.max(0, d.amountLeft);
  switch (d.plan.kind) {
    case "oneOff":
      return d.plan.due >= start && d.plan.due <= end ? left : 0;
    case "installments":
      return Math.min(d.plan.perCycle, left);
    case "flexible":
      return Math.min(d.plan.min, left);
  }
}

/** R7 */
export function sinkingSetAside(f: EngineInput["sinkingFunds"][number], start: ISODate, payday: number): Minor {
  const remaining = f.target - f.saved;
  if (remaining <= 0 || f.due < start) return 0;
  const cyclesLeft = 1 + laterPaydays(start, payday, f.due).length;
  return Math.ceil(remaining / cyclesLeft);
}

/** R5–R10, R24, R26 */
export function computePlan(input: EngineInput, projectedEnd: ISODate) {
  const { salary, start } = input.cycle;
  const s = input.settings;
  const events: EngineEvent[] = [];
  const suggestions: Suggestion[] = [];

  const bills = input.bills.reduce((a, b) => a + b.amount, 0);

  const savingsGoal = Math.round((salary * s.savingsPercent) / 100);
  const savingsFloor = Math.round((salary * s.minSavingsPercent) / 100);
  let savingsRoom = Math.max(0, savingsGoal - savingsFloor);
  const topUp = (id: string) => Math.max(0, input.topUps?.find((t) => t.id === id)?.amount ?? 0);
  // R26: cleared installment debts keep paying, into the current attack target (snowball).
  const target = attackOrder(input.debts)[0];
  const freed = input.debts.reduce(
    (a, d) => a + (d.amountLeft <= 0 && d.plan.kind === "installments" ? d.plan.perCycle : 0),
    0,
  );

  const debts = input.debts.map((d) => {
    const base = debtDue(d, start, projectedEnd);
    // R24: an accepted top-up lifts a flexible debt toward its ideal, never past it or the amount left.
    const withTopUp =
      d.plan.kind === "flexible"
        ? Math.min(base + topUp(d.id), Math.max(base, Math.min(d.plan.ideal, d.amountLeft)))
        : base;
    const rolledIn = d.id === target?.id ? Math.min(freed, Math.max(0, d.amountLeft - withTopUp)) : 0;
    const due = withTopUp + rolledIn;
    const fromSavings = Math.min(due, savingsRoom);
    savingsRoom -= fromSavings;
    return { id: d.id, due, fromSavings, fromFlexible: due - fromSavings, rolledIn };
  });
  const dueBeforeSnowball = (id: string) => {
    const d = debts.find((x) => x.id === id)!;
    return d.due - d.rolledIn;
  };
  const fromSavings = debts.reduce((a, d) => a + d.fromSavings, 0);
  const debtTotal = debts.reduce((a, d) => a + d.due, 0);
  const savingsPlanned = savingsGoal - fromSavings;
  if (fromSavings > 0) events.push({ type: "debtSqueezesSavings", amount: fromSavings });

  const sinking = input.sinkingFunds.map((f) => ({
    id: f.id,
    setAside: sinkingSetAside(f, start, s.expectedPayday),
  }));
  const commitments = input.commitments.map((c) => ({
    id: c.id,
    amount: c.min + Math.min(topUp(c.id), Math.max(0, c.ideal - c.min)),
  }));

  const raw =
    salary -
    bills -
    sinking.reduce((a, f) => a + f.setAside, 0) -
    commitments.reduce((a, c) => a + c.amount, 0) -
    debtTotal -
    savingsPlanned;
  const flexible = Math.max(0, raw);

  const squeezed = raw < 0 || flexible < salary * TIGHT_RATIO;
  if (raw < 0) events.push({ type: "overcommitted", shortfall: -raw });
  else if (squeezed) events.push({ type: "tight", flexible });
  if (squeezed) {
    for (const d of input.debts) {
      if (d.plan.kind === "oneOff" && debts.find((x) => x.id === d.id)!.due > 0)
        suggestions.push({ kind: "splitDebt", debtId: d.id });
    }
  }

  if (s.everydayEstimate !== null) {
    let headroom = flexible - s.everydayEstimate;
    const gaps = [
      ...input.commitments.map((c) => ({ id: c.id, gap: c.ideal - commitments.find((x) => x.id === c.id)!.amount })),
      ...input.debts.flatMap((d) =>
        d.plan.kind === "flexible"
          ? [{ id: d.id, gap: Math.min(d.plan.ideal, d.amountLeft) - dueBeforeSnowball(d.id) }]
          : [],
      ),
    ];
    for (const { id, gap } of gaps) {
      if (headroom <= 0) break;
      const amount = Math.min(gap, headroom);
      if (amount > 0) {
        suggestions.push({ kind: "idealTopUp", id, amount });
        headroom -= amount;
      }
    }
  }

  const plan: PlanBreakdown = { salary, bills, sinking, commitments, debts, savingsGoal, savingsPlanned, flexible };
  return { plan, events, suggestions };
}
