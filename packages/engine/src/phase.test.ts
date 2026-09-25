import { describe, expect, it } from "vitest";
import { computeOpenCycle } from "./cycle";
import { addMonths } from "./date";
import { attackOrder, detectPhase } from "./phase";
import type { Debt, EngineInput } from "./types";

const NGN = (n: number) => n * 100;

const base = (o: Partial<EngineInput> = {}, settings: Partial<EngineInput["settings"]> = {}): EngineInput => ({
  today: "2026-06-10",
  settings: {
    savingsPercent: 10,
    minSavingsPercent: 5,
    floorPercent: 70,
    weekStart: 0,
    expectedPayday: 1,
    everydayEstimate: null,
    leftoverDefault: "savings",
    ...settings,
  },
  cycle: { start: "2026-06-01", salary: NGN(400_000) },
  bills: [{ id: "rent", name: "Rent", amount: NGN(60_000) }],
  sinkingFunds: [],
  debts: [],
  commitments: [],
  transactions: [],
  sweepChoices: {},
  debtPayments: [],
  ...o,
});

const debt = (id: string, amountLeft: number, perCycle: number, hasInterest = false): Debt => ({
  id,
  name: id,
  creditor: id,
  amountLeft: NGN(amountLeft),
  hasInterest,
  plan: { kind: "installments", perCycle: NGN(perCycle) },
});

const read = (i: EngineInput) => detectPhase(i, computeOpenCycle(i));

describe("R21 leftover default", () => {
  const spent = [{ id: "t", amount: NGN(50_000), date: "2026-06-03", type: "spend" as const }];

  it("sends an unchosen week's leftover to the attack target", () => {
    const i = base(
      { debts: [debt("big", 200_000, 10_000), debt("small", 30_000, 5_000)], transactions: spent },
      { leftoverDefault: "debts" },
    );
    const s = computeOpenCycle(i);
    expect(s.weeks[0]!.outcome).toMatchObject({ kind: "swept", to: { debtId: "small" } });
    expect(s.savings.swept).toBe(0);
  });

  it("an explicit choice still wins", () => {
    const i = base(
      { debts: [debt("small", 30_000, 5_000)], transactions: spent, sweepChoices: { 0: { to: "savings" } } },
      { leftoverDefault: "debts" },
    );
    expect(computeOpenCycle(i).weeks[0]!.outcome).toMatchObject({ to: "savings" });
  });

  it("falls back to savings when there are no debts", () => {
    const i = base({ transactions: spent }, { leftoverDefault: "debts" });
    expect(computeOpenCycle(i).weeks[0]!.outcome).toMatchObject({ to: "savings" });
  });
});

describe("R22 attack order", () => {
  it("puts interest-bearing debts first, then the smallest balance, and skips cleared ones", () => {
    const order = attackOrder([
      debt("a", 50_000, 1),
      debt("b", 90_000, 1, true),
      debt("c", 10_000, 1),
      debt("done", 0, 1),
    ]);
    expect(order.map((d) => d.id)).toEqual(["b", "c", "a"]);
  });
});

describe("R23 phase", () => {
  it("no active debts is Build", () => {
    expect(read(base({ debts: [debt("done", 0, 1_000)] }))).toEqual({
      phase: "build",
      next: null,
      unlocksAround: null,
    });
  });

  it("debts the plan covers comfortably is Attack, with a payoff estimate", () => {
    // 15,000 a cycle fits inside the savings room; 90,000 left takes 6 cycles.
    const r = read(base({ debts: [debt("loan", 90_000, 15_000)] }));
    expect(r).toEqual({ phase: "attack", next: "build", unlocksAround: addMonths("2026-06-01", 6) });
  });

  it("repayments spilling into spending money is Stabilise", () => {
    // 50,000 due: 20,000 from savings, 30,000 from flexible.
    const r = read(base({ debts: [debt("loan", 150_000, 50_000), debt("app", 40_000, 10_000)] }));
    expect(r.phase).toBe("stabilise");
    expect(r.unlocksAround).toBe(addMonths("2026-06-01", 3));
  });

  it("an overcommitted plan is Stabilise even with a small debt", () => {
    const r = read(
      base({ bills: [{ id: "b", name: "Rent", amount: NGN(390_000) }], debts: [debt("x", 10_000, 1_000)] }),
    );
    expect(r.phase).toBe("stabilise");
  });

  it("has no estimate when nothing is being repaid", () => {
    const flexible: Debt = { ...debt("uncle", 150_000, 1), plan: { kind: "flexible", min: 0, ideal: NGN(10_000) } };
    expect(read(base({ debts: [flexible] }))).toEqual({ phase: "attack", next: "build", unlocksAround: null });
  });
});

describe("addMonths", () => {
  it("clamps to month end", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
  });
});

describe("R26 snowball", () => {
  const cleared = (id: string, perCycle: number): Debt => ({ ...debt(id, 0, perCycle), amountLeft: 0 });

  it("rolls a cleared installment onto the attack target", () => {
    const s = computeOpenCycle(base({ debts: [cleared("gone", 45_000), debt("next", 300_000, 10_000)] }));
    expect(s.plan.debts.find((d) => d.id === "next")).toMatchObject({ due: NGN(55_000), rolledIn: NGN(45_000) });
    expect(s.plan.debts.find((d) => d.id === "gone")).toMatchObject({ due: 0, rolledIn: 0 });
  });

  it("never rolls more than the target has left", () => {
    const s = computeOpenCycle(base({ debts: [cleared("gone", 45_000), debt("next", 20_000, 10_000)] }));
    expect(s.plan.debts.find((d) => d.id === "next")).toMatchObject({ due: NGN(20_000), rolledIn: NGN(10_000) });
  });

  it("frees the payment once nothing is left to attack", () => {
    const s = computeOpenCycle(base({ debts: [cleared("gone", 45_000)] }));
    expect(s.plan.debts[0]).toMatchObject({ due: 0, rolledIn: 0 });
    expect(s.plan.flexible).toBe(NGN(400_000 - 60_000 - 40_000));
  });
});
