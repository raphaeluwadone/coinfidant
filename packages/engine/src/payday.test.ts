import { describe, expect, it } from "vitest";
import { computeOpenCycle } from "./cycle";
import { discoveryProgress, type DiscoveryTxn } from "./discovery";
import type { Debt, EngineInput } from "./types";

const NGN = (n: number) => n * 100;

const base = (o: Partial<EngineInput> = {}, estimate: number | null = null): EngineInput => ({
  today: "2026-06-10",
  settings: {
    savingsPercent: 10,
    minSavingsPercent: 5,
    floorPercent: 70,
    weekStart: 0,
    expectedPayday: 1,
    everydayEstimate: estimate,
    leftoverDefault: "savings",
  },
  cycle: { start: "2026-06-01", salary: NGN(400_000) },
  bills: [],
  sinkingFunds: [],
  debts: [],
  commitments: [{ id: "sis", name: "Sister", min: NGN(20_000), ideal: NGN(50_000) }],
  transactions: [],
  sweepChoices: {},
  debtPayments: [],
  ...o,
});

describe("R24 accepted top-ups", () => {
  it("adds the top-up to a commitment and takes it from flexible", () => {
    const s = computeOpenCycle(base({ topUps: [{ id: "sis", amount: NGN(30_000) }] }));
    expect(s.plan.commitments).toEqual([{ id: "sis", amount: NGN(50_000) }]);
    expect(s.plan.flexible).toBe(NGN(400_000 - 40_000 - 50_000));
  });

  it("never goes past the ideal", () => {
    const s = computeOpenCycle(base({ topUps: [{ id: "sis", amount: NGN(99_000) }] }));
    expect(s.plan.commitments[0]!.amount).toBe(NGN(50_000));
  });

  it("only suggests the gap that's left", () => {
    const s = computeOpenCycle(base({ topUps: [{ id: "sis", amount: NGN(10_000) }] }, NGN(100_000)));
    expect(s.suggestions).toEqual([{ kind: "idealTopUp", id: "sis", amount: NGN(20_000) }]);
    const full = computeOpenCycle(base({ topUps: [{ id: "sis", amount: NGN(30_000) }] }, NGN(100_000)));
    expect(full.suggestions).toEqual([]);
  });

  it("lifts a flexible debt up to its ideal or what's left, whichever is lower", () => {
    const uncle: Debt = {
      id: "uncle",
      name: "Uncle",
      creditor: "Family",
      amountLeft: NGN(25_000),
      hasInterest: false,
      plan: { kind: "flexible", min: NGN(5_000), ideal: NGN(40_000) },
    };
    const s = computeOpenCycle(
      base({ commitments: [], debts: [uncle], topUps: [{ id: "uncle", amount: NGN(50_000) }] }),
    );
    expect(s.plan.debts[0]!.due).toBe(NGN(25_000));
  });
});

describe("R25 discovery progress", () => {
  const spend = (date: string, amount: number, categoryId = "food"): DiscoveryTxn => ({
    date,
    amount: NGN(amount),
    type: "spend",
    categoryId,
  });
  const cycle = { start: "2026-06-01", days: 30 };

  it("learns a category after 3 spends on 2 or more days and projects it monthly", () => {
    const txns = [
      spend("2026-06-02", 2_000),
      spend("2026-06-02", 1_000),
      spend("2026-06-09", 3_000),
      spend("2026-06-05", 900, "fun"),
    ];
    const p = discoveryProgress(txns, cycle, "2026-06-15");
    expect(p.day).toBe(15);
    // 6,000 over 15 days, projected to 30: 12,000.
    expect(p.categories[0]).toEqual({ categoryId: "food", spent: NGN(6_000), monthly: NGN(12_000) });
    expect(p.categories[1]).toEqual({ categoryId: "fun", spent: NGN(900), monthly: null });
  });

  it("confidence grows with time and consistent logging", () => {
    const every = Array.from({ length: 15 }, (_, i) => spend(`2026-06-${String(i + 1).padStart(2, "0")}`, 100));
    expect(discoveryProgress(every, cycle, "2026-06-15").confidence).toBe(Math.round(100 * (0.7 * 0.5 + 0.3)));
    expect(discoveryProgress([spend("2026-06-01", 100)], cycle, "2026-06-15").confidence).toBe(
      Math.round(100 * (0.35 + 0.02)),
    );
    expect(discoveryProgress([], cycle, "2026-06-01").confidence).toBe(Math.round(100 * (0.7 / 30)));
  });

  it("final figures are the real totals", () => {
    const p = discoveryProgress([spend("2026-06-03", 64_234), spend("2026-06-20", 5_000, "fun")], cycle, "2026-06-30", {
      final: true,
    });
    expect(p.confidence).toBe(100);
    expect(p.categories).toEqual([
      { categoryId: "food", spent: NGN(64_234), monthly: NGN(64_200) },
      { categoryId: "fun", spent: NGN(5_000), monthly: NGN(5_000) },
    ]);
  });
});
