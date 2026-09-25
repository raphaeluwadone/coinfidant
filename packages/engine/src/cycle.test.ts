import { describe, expect, it } from "vitest";
import { allocate, spreadDeficit } from "./alloc";
import { projectedEnd } from "./calendar";
import { closeCycle, computeOpenCycle } from "./cycle";
import { weekday } from "./date";
import { formatMoney } from "./money";
import type { Debt, EngineInput } from "./types";

const NGN = (n: number) => n * 100;
let seq = 0;
const spend = (date: string, amount: number, type: "spend" | "refund" = "spend") => ({
  id: `t${++seq}`,
  date,
  amount: NGN(amount),
  type,
});

type Overrides = Partial<Omit<EngineInput, "settings" | "cycle">> & {
  settings?: Partial<EngineInput["settings"]>;
  cycle?: Partial<EngineInput["cycle"]>;
};

/** Spec fixture: NGN 400,000 salary, 10% savings, 5% min, 70% floor, Monday weeks, no bills. */
function input(o: Overrides = {}): EngineInput {
  return {
    today: "2026-06-10",
    bills: [],
    sinkingFunds: [],
    debts: [],
    commitments: [],
    transactions: [],
    sweepChoices: {},
    debtPayments: [],
    ...o,
    settings: {
      savingsPercent: 10,
      minSavingsPercent: 5,
      floorPercent: 70,
      weekStart: 0,
      expectedPayday: 1,
      everydayEstimate: null,
      leftoverDefault: "savings",
      ...o.settings,
    },
    cycle: { start: "2026-06-01", salary: NGN(400_000), ...o.cycle },
  };
}

// June 2026 starts on a Monday. With NGN 60,000 rent, flexible is NGN 300,000: NGN 10,000 a day, 70,000 a full week.
const RENT = [{ id: "rent", name: "Rent", amount: NGN(60_000) }];
const june = (o: Overrides = {}) => input({ bills: RENT, ...o });

const debt = (plan: Debt["plan"], amountLeft = 1_000_000): Debt => ({
  id: "d1",
  name: "Loan",
  creditor: "Bank",
  amountLeft: NGN(amountLeft),
  hasInterest: false,
  plan,
});

describe("cycle dates", () => {
  it("1. payday 31, salary marked 30 Sep 2026: projected end 30 Oct", () => {
    expect(projectedEnd("2026-09-30", 31)).toBe("2026-10-30");
  });

  it("2. payday 31 in February: projected end 30 Mar", () => {
    expect(projectedEnd("2026-02-28", 31)).toBe("2026-03-30");
    expect(projectedEnd("2028-02-29", 31)).toBe("2028-03-30");
  });

  it("3. crosses the year boundary", () => {
    expect(projectedEnd("2026-12-31", 31)).toBe("2027-01-30");
  });

  it("R2: early or late salary still belongs to the nearest payday", () => {
    expect(projectedEnd("2026-09-28", 31)).toBe("2026-10-30");
    expect(projectedEnd("2026-10-02", 31)).toBe("2026-10-30");
  });

  it("4. salary a day early on a Wednesday starts a 5-day first week", () => {
    // Payday 2: 2 Jul 2026 is a Thursday, salary lands Wednesday 1 Jul.
    const s = computeOpenCycle(
      input({ today: "2026-07-01", settings: { expectedPayday: 2 }, cycle: { start: "2026-07-01" } }),
    );
    expect(s.cycle.start).toBe("2026-07-01");
    expect(s.cycle.projectedEnd).toBe("2026-08-01");
    expect(s.weeks[0]).toMatchObject({ start: "2026-07-01", end: "2026-07-05", days: 5 });
  });

  it("5. late salary: overrun days share the final week and flag salaryOverdue", () => {
    const day1 = computeOpenCycle(june({ today: "2026-07-01" }));
    expect(day1.cycle.overrunDays).toBe(1);
    expect(day1.today.week.index).toBe(4);
    expect(day1.today.daysLeftInWeek).toBe(3);
    expect(day1.today.dailyPace).toBe(Math.floor(NGN(20_000) / 3));
    expect(day1.events.some((e) => e.type === "salaryOverdue")).toBe(false);

    const day3 = computeOpenCycle(june({ today: "2026-07-03", transactions: [spend("2026-07-02", 5_000)] }));
    expect(day3.cycle.overrunDays).toBe(3);
    expect(day3.today.leftThisWeek).toBe(NGN(15_000));
    expect(day3.events).toContainEqual({ type: "salaryOverdue", daysLate: 2 });
  });

  it("6. one day past the expected payday is not overdue yet", () => {
    const s = computeOpenCycle(june({ today: "2026-07-02" }));
    expect(s.events.some((e) => e.type === "salaryOverdue")).toBe(false);
  });
});

describe("weeks and days", () => {
  it("7. 31-day cycle starting Tuesday: weeks sum to flexible, remainder on the last", () => {
    const s = computeOpenCycle(input({ today: "2026-12-01", cycle: { start: "2026-12-01", salary: 400_000_07 } }));
    expect(weekday("2026-12-01")).toBe(1);
    expect(s.cycle.days).toBe(31);
    const { flexible } = s.plan;
    expect(s.weeks.reduce((a, w) => a + w.base, 0)).toBe(flexible);
    s.weeks.slice(0, -1).forEach((w) => expect(w.base).toBe(Math.floor((flexible * w.days) / 31)));
    s.weeks.slice(0, -1).forEach((w) => expect(weekday(w.end)).toBe(6));
  });

  it("R11: honours a Sunday week start", () => {
    const s = computeOpenCycle(june({ settings: { weekStart: 6 } }));
    expect(s.weeks[0]).toMatchObject({ start: "2026-06-01", end: "2026-06-06", days: 6 });
  });

  it("8. Monday spend lowers Tuesday's allowance", () => {
    const s = computeOpenCycle(june({ today: "2026-06-02", transactions: [spend("2026-06-01", 7_000)] }));
    expect(s.today.dailyPace).toBe(Math.floor(NGN(63_000) / 6));
  });

  it("9. today's spend lowers spendToday one to one, not the pace", () => {
    const base = june({ transactions: [spend("2026-06-08", 15_000), spend("2026-06-09", 5_000)] });
    const before = computeOpenCycle(base);
    const after = computeOpenCycle({ ...base, transactions: [...base.transactions, spend("2026-06-10", 3_000)] });
    expect(after.today.dailyPace).toBe(before.today.dailyPace);
    expect(after.today.spendToday).toBe(before.today.spendToday - NGN(3_000));
    expect(after.today).toMatchObject({ daysLeftInWeek: 5, dailyPace: NGN(10_000), spendToday: NGN(7_000) });
  });

  it("16. refunds reduce the day's spending", () => {
    const s = computeOpenCycle(
      june({ transactions: [spend("2026-06-10", 5_000), spend("2026-06-10", 2_000, "refund")] }),
    );
    expect(s.today.spentToday).toBe(NGN(3_000));
  });

  it("colours the week strip from real data", () => {
    const s = computeOpenCycle(june({ transactions: [spend("2026-06-08", 8_000), spend("2026-06-09", 14_000)] }));
    expect(s.today.strip.map((d) => d.state)).toEqual([
      "on",
      "covered",
      "today",
      "upcoming",
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
  });

  it("marks days outside a short final week", () => {
    const s = computeOpenCycle(june({ today: "2026-06-30" }));
    expect(s.today.strip.map((d) => d.state)).toEqual([
      "on",
      "today",
      "outside",
      "outside",
      "outside",
      "outside",
      "outside",
    ]);
  });
});

describe("week end", () => {
  it("10. an underspent week sweeps to savings by default", () => {
    const s = computeOpenCycle(june({ transactions: [spend("2026-06-03", 50_000)] }));
    expect(s.weeks[0]!.outcome).toEqual({ kind: "swept", amount: NGN(20_000), to: "savings" });
    expect(s.savings).toMatchObject({ planned: NGN(40_000), swept: NGN(20_000), borrowed: 0, net: NGN(60_000) });
  });

  it("11. a sweep can go to a debt instead", () => {
    const s = computeOpenCycle(
      june({
        debts: [debt({ kind: "installments", perCycle: NGN(10_000) })],
        transactions: [spend("2026-06-03", 50_000)],
        sweepChoices: { 0: { to: "debt", debtId: "d1" } },
      }),
    );
    expect(s.savings.swept).toBe(0);
    expect(s.savings.sweptToDebts).toEqual([{ debtId: "d1", amount: s.weeks[0]!.base - NGN(50_000) }]);
    expect(s.events).toContainEqual(expect.objectContaining({ type: "sweep", to: "d1" }));
  });

  it("12. a small overspend spreads across later weeks, none below the floor", () => {
    const s = computeOpenCycle(june({ transactions: [spend("2026-06-05", 80_000)] }));
    expect(s.weeks[0]!.outcome).toEqual({
      kind: "over",
      amount: NGN(10_000),
      spread: NGN(10_000),
      borrowed: 0,
      floorHit: false,
    });
    const later = s.weeks.slice(1);
    expect(later.reduce((a, w) => a + w.budget, 0)).toBe(NGN(220_000));
    later.forEach((w) => expect(w.budget).toBeGreaterThanOrEqual(w.floor));
    expect(s.events).toContainEqual({ type: "carryForward", week: 0, amount: NGN(10_000) });
  });

  it("13. past the floor, the rest is borrowed from savings", () => {
    const s = computeOpenCycle(june({ transactions: [spend("2026-06-06", 200_000)] }));
    // Room above the floors: 3 × 21,000 + 6,000 = 69,000 of a 130,000 deficit.
    expect(s.weeks[0]!.outcome).toEqual({
      kind: "over",
      amount: NGN(130_000),
      spread: NGN(69_000),
      borrowed: NGN(61_000),
      floorHit: true,
    });
    expect(s.weeks.slice(1).map((w) => w.budget)).toEqual([NGN(49_000), NGN(49_000), NGN(49_000), NGN(14_000)]);
    expect(s.savings.net).toBe(NGN(40_000 - 61_000));
    expect(s.events).toContainEqual({ type: "borrowedFromSavings", week: 0, amount: NGN(61_000) });
  });

  it("R16: floor percent is configurable", () => {
    const s = computeOpenCycle(june({ settings: { floorPercent: 50 }, transactions: [spend("2026-06-06", 200_000)] }));
    expect(s.weeks[1]!.floor).toBe(NGN(35_000));
    expect(s.savings.borrowed).toBe(NGN(130_000 - 3 * 35_000 - 10_000));
  });

  it("14. final-week overspend shows as negative, then is borrowed at close", () => {
    const i = june({ today: "2026-06-30", transactions: [spend("2026-06-29", 25_000)] });
    const open = computeOpenCycle(i);
    expect(open.today.leftThisWeek).toBe(NGN(-5_000));
    expect(open.today.spendToday).toBe(0);
    const closed = closeCycle(i, "2026-07-01");
    expect(closed.weeks[4]!.outcome).toMatchObject({ kind: "over", borrowed: NGN(5_000), floorHit: true });
    expect(closed.savings.borrowed).toBe(NGN(5_000));
  });

  it("15. a back-dated spend flips a swept week to a carry-forward", () => {
    const base = june({ today: "2026-06-17", transactions: [spend("2026-06-02", 30_000)] });
    expect(computeOpenCycle(base).weeks[0]!.outcome?.kind).toBe("swept");
    const s = computeOpenCycle({ ...base, transactions: [...base.transactions, spend("2026-06-04", 60_000)] });
    expect(s.weeks[0]!.outcome).toMatchObject({ kind: "over", amount: NGN(20_000) });
    expect(s.weeks.slice(1).reduce((a, w) => a + w.budget, 0)).toBe(NGN(210_000));
  });

  it("ignores transactions outside the cycle", () => {
    const s = computeOpenCycle(june({ transactions: [spend("2026-05-31", 999_000)] }));
    expect(s.weeks[0]!.outcome?.kind).toBe("swept");
  });
});

describe("plan: debts", () => {
  it("17. no debt: savings stay at the goal", () => {
    const s = computeOpenCycle(input());
    expect(s.plan).toMatchObject({ savingsGoal: NGN(40_000), savingsPlanned: NGN(40_000), flexible: NGN(360_000) });
  });

  it("18. a debt absorbed by savings leaves flexible unchanged", () => {
    const s = computeOpenCycle(input({ debts: [debt({ kind: "installments", perCycle: NGN(15_000) })] }));
    expect(s.plan.debts).toEqual([
      { id: "d1", due: NGN(15_000), fromSavings: NGN(15_000), fromFlexible: 0, rolledIn: 0 },
    ]);
    expect(s.plan).toMatchObject({ savingsPlanned: NGN(25_000), flexible: NGN(360_000) });
  });

  it("19. a debt spilling into flexible stops savings at 5%", () => {
    const s = computeOpenCycle(input({ debts: [debt({ kind: "installments", perCycle: NGN(50_000) })] }));
    expect(s.plan.debts).toEqual([
      { id: "d1", due: NGN(50_000), fromSavings: NGN(20_000), fromFlexible: NGN(30_000), rolledIn: 0 },
    ]);
    expect(s.plan).toMatchObject({ savingsPlanned: NGN(20_000), flexible: NGN(330_000) });
    expect(s.events).toContainEqual({ type: "debtSqueezesSavings", amount: NGN(20_000) });
  });

  it("20. a debt exceeding everything zeroes flexible and suggests a split", () => {
    const s = computeOpenCycle(input({ debts: [debt({ kind: "oneOff", due: "2026-06-20" }, 500_000)] }));
    expect(s.plan.flexible).toBe(0);
    expect(s.events).toContainEqual({ type: "overcommitted", shortfall: NGN(120_000) });
    expect(s.suggestions).toContainEqual({ kind: "splitDebt", debtId: "d1" });
    expect(s.today.spendToday).toBe(0);
  });

  it("21. a one-off due next cycle costs nothing now", () => {
    const s = computeOpenCycle(input({ debts: [debt({ kind: "oneOff", due: "2026-07-15" })] }));
    expect(s.plan.debts[0]!.due).toBe(0);
  });

  it("22. installments never exceed what is left", () => {
    const s = computeOpenCycle(input({ debts: [debt({ kind: "installments", perCycle: NGN(50_000) }, 30_000)] }));
    expect(s.plan.debts[0]!.due).toBe(NGN(30_000));
  });

  it("R6: a goal already below the minimum isn't touched", () => {
    const s = computeOpenCycle(
      input({ settings: { savingsPercent: 3 }, debts: [debt({ kind: "installments", perCycle: NGN(10_000) })] }),
    );
    expect(s.plan.debts[0]).toMatchObject({ fromSavings: 0, fromFlexible: NGN(10_000) });
    expect(s.plan.savingsPlanned).toBe(NGN(12_000));
  });
});

describe("plan: sinking funds and commitments", () => {
  const rent = { id: "rent", name: "Rent", target: NGN(600_000), saved: 0, due: "2027-03-15" };
  const sep = (o: Overrides = {}) =>
    input({ today: "2026-10-01", settings: { expectedPayday: 31 }, cycle: { start: "2026-09-30" }, ...o });

  it("23. rent due in 6 cycles sets aside a sixth each cycle", () => {
    const s = computeOpenCycle(sep({ sinkingFunds: [rent] }));
    expect(s.plan.sinking).toEqual([{ id: "rent", setAside: NGN(100_000) }]);
    expect(s.plan.flexible).toBe(NGN(400_000 - 40_000 - 100_000));
  });

  it("24. a funded or overdue fund sets aside nothing", () => {
    const funded = computeOpenCycle(sep({ sinkingFunds: [{ ...rent, saved: NGN(600_000) }] }));
    const overdue = computeOpenCycle(sep({ sinkingFunds: [{ ...rent, due: "2026-09-01" }] }));
    expect(funded.plan.sinking[0]!.setAside).toBe(0);
    expect(overdue.plan.sinking[0]!.setAside).toBe(0);
  });

  it("R7: a fund due inside this cycle is set aside in full", () => {
    const s = computeOpenCycle(sep({ sinkingFunds: [{ ...rent, due: "2026-10-20", saved: NGN(450_000) }] }));
    expect(s.plan.sinking[0]!.setAside).toBe(NGN(150_000));
  });

  const support = { id: "sis", name: "Sister", min: NGN(20_000), ideal: NGN(50_000) };

  it("25. commitments budget the minimum and suggest the ideal when there's room", () => {
    // Flexible = 400,000 - 40,000 - 20,000 = 340,000; estimate 300,000 leaves 40,000 headroom.
    const s = computeOpenCycle(input({ commitments: [support], settings: { everydayEstimate: NGN(300_000) } }));
    expect(s.plan.commitments).toEqual([{ id: "sis", amount: NGN(20_000) }]);
    expect(s.suggestions).toEqual([{ kind: "idealTopUp", id: "sis", amount: NGN(30_000) }]);
  });

  it("25b. headroom is shared in list order and runs out", () => {
    const s = computeOpenCycle(
      input({
        commitments: [support, { id: "mum", name: "Mum", min: NGN(10_000), ideal: NGN(40_000) }],
        settings: { everydayEstimate: NGN(290_000) },
      }),
    );
    // Flexible 330,000, headroom 40,000: sister takes 30,000, mum gets the last 10,000.
    expect(s.suggestions).toEqual([
      { kind: "idealTopUp", id: "sis", amount: NGN(30_000) },
      { kind: "idealTopUp", id: "mum", amount: NGN(10_000) },
    ]);
  });

  it("26. no estimate, no top-up suggestions", () => {
    const s = computeOpenCycle(input({ commitments: [support] }));
    expect(s.suggestions).toEqual([]);
  });

  it("27. flexible under 10% of salary is tight", () => {
    const s = computeOpenCycle(input({ bills: [{ id: "b", name: "Rent", amount: NGN(330_000) }] }));
    expect(s.events).toContainEqual({ type: "tight", flexible: NGN(30_000) });
  });
});

describe("closeCycle", () => {
  it("28. closing twice gives identical snapshots", () => {
    const i = june({ today: "2026-07-01", transactions: [spend("2026-06-03", 50_000), spend("2026-06-20", 90_000)] });
    expect(closeCycle(i, "2026-07-01")).toEqual(closeCycle(i, "2026-07-01"));
  });

  it("29. savings rate counts sweeps and borrowing", () => {
    const untouched = closeCycle(june(), "2026-07-01");
    expect(untouched.savings.net).toBe(NGN(340_000));
    expect(untouched.savingsRateBp).toBe(8_500);

    const borrowed = closeCycle(june({ transactions: [spend("2026-06-06", 200_000)] }), "2026-07-01");
    // Later weeks drop to their floors (161,000 in total) and sweep whole; 61,000 was borrowed.
    expect(borrowed.savings).toMatchObject({ swept: NGN(161_000), borrowed: NGN(61_000), net: NGN(140_000) });
    expect(borrowed.savingsRateBp).toBe(3_500);
  });

  it("R3: early salary sweeps the weeks that never happened", () => {
    const c = closeCycle(june({ transactions: [spend("2026-06-26", 5_000)] }), "2026-06-25");
    expect(c.cycle.end).toBe("2026-06-24");
    expect(c.spent).toBe(0);
    expect(c.weeks.every((w) => w.outcome?.kind === "swept")).toBe(true);
  });

  it("rolls debts and sinking funds forward", () => {
    const c = closeCycle(
      june({
        debts: [debt({ kind: "installments", perCycle: NGN(20_000) }, 100_000)],
        debtPayments: [{ debtId: "d1", amount: NGN(15_000) }],
        sinkingFunds: [{ id: "fees", name: "School fees", target: NGN(120_000), saved: 0, due: "2026-08-15" }],
      }),
      "2026-07-01",
    );
    expect(c.debts).toEqual([{ id: "d1", amountLeft: NGN(85_000), unpaid: NGN(5_000) }]);
    // Due 15 Aug: this cycle plus the 1 Jul and 1 Aug paydays, so a third each.
    expect(c.sinkingFunds).toEqual([{ id: "fees", saved: NGN(40_000) }]);
    expect(c.engineVersion).toBe("1.0.0");
  });
});

describe("helpers", () => {
  it("allocate sums exactly", () => {
    expect(allocate(1000, [7, 7, 7, 2])).toEqual([305, 304, 304, 87]);
  });

  it("spreadDeficit refills from weeks with room and reports the rest", () => {
    expect(spreadDeficit(900, [1, 1, 1], [100, 500, 500])).toEqual({ taken: [100, 400, 400], leftover: 0 });
    expect(spreadDeficit(900, [1, 1], [100, 200]).leftover).toBe(600);
  });

  it("formatMoney uses NGN with a non-breaking space", () => {
    expect(formatMoney(NGN(12_500))).toBe("NGN 12,500");
    expect(formatMoney(NGN(-5_000))).toBe("-NGN 5,000");
    expect(formatMoney(-20)).toBe("NGN 0");
  });
});
