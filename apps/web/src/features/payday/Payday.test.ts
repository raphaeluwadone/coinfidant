import { computeOpenCycle, type EngineInput } from "@coinfidant/engine";
import { describe, expect, it } from "vitest";
import type { Budget } from "../../lib/budget";
import type { TodayData } from "../../lib/today";
import { feedRows } from "./Payday";

const NGN = (n: number) => n * 100;

const input: EngineInput = {
  today: "2026-09-30",
  settings: {
    savingsPercent: 10,
    minSavingsPercent: 5,
    floorPercent: 70,
    weekStart: 0,
    expectedPayday: 31,
    everydayEstimate: NGN(100_000),
    leftoverDefault: "savings",
  },
  cycle: { start: "2026-09-30", salary: NGN(1_000_000) },
  bills: [{ id: "b1", name: "Electricity", amount: NGN(40_000) }],
  sinkingFunds: [{ id: "f1", name: "Rent", target: NGN(700_000), saved: 0, due: "2027-03-01" }],
  debts: [
    {
      id: "d1",
      name: "OPay",
      creditor: "Loan app",
      amountLeft: NGN(88_000),
      hasInterest: true,
      plan: { kind: "installments", perCycle: NGN(15_000) },
    },
  ],
  commitments: [{ id: "c1", name: "Sister", min: NGN(20_000), ideal: NGN(50_000) }],
  transactions: [],
  sweepChoices: {},
  debtPayments: [],
};

const budget = {
  bills: [{ id: "b1", name: "Electricity", amount: NGN(40_000) }],
  sinkingFunds: [{ id: "f1", name: "Rent", target: NGN(700_000), saved: 0, dueDate: "2027-03-01" }],
  debts: [
    {
      id: "d1",
      name: "OPay",
      creditor: "Loan app",
      amountLeft: NGN(88_000),
      plan: "installments",
      minAmount: null,
      idealAmount: null,
    },
  ],
  commitments: [{ id: "c1", name: "Sister", minAmount: NGN(20_000), idealAmount: NGN(50_000) }],
} as unknown as Budget;

const today = (o: Partial<EngineInput> = {}, topUps: NonNullable<TodayData["topUps"]> = []) =>
  ({ snapshot: computeOpenCycle({ ...input, ...o, topUps }), topUps }) as unknown as TodayData;

describe("payday checklist", () => {
  it("feeds bills, set-asides, debt minimums, then people, in that order", () => {
    const rows = feedRows(today(), budget);
    expect(rows.map((r) => r.label)).toEqual(["💡 Electricity", "🏠 Rent fund", "📱 OPay minimum", "👤 Sister"]);
    // Rent: 700,000 over this cycle and 5 later paydays before 1 March.
    expect(rows.map((r) => r.amount)).toEqual([NGN(40_000), Math.ceil(NGN(700_000) / 6), NGN(15_000), NGN(20_000)]);
  });

  it("offers the ideal top-up where the engine finds room, and shows it once accepted", () => {
    const offered = feedRows(today(), budget).find((r) => r.key === "c1")!;
    expect(offered.topUp).toEqual({ id: "c1", offer: NGN(30_000), accepted: 0 });

    const taken = feedRows(today({}, [{ id: "c1", amount: NGN(30_000) }]), budget).find((r) => r.key === "c1")!;
    expect(taken).toMatchObject({
      label: "👤 Sister (ideal)",
      amount: NGN(50_000),
      topUp: { offer: 0, accepted: NGN(30_000) },
    });
  });

  it("offers nothing without an everyday estimate", () => {
    const rows = feedRows(today({ settings: { ...input.settings, everydayEstimate: null } }), budget);
    expect(rows.find((r) => r.key === "c1")!.topUp).toBeUndefined();
  });
});
