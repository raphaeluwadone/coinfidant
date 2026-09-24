import { describe, expect, it } from "vitest";
import { allocate, computeSnapshot, cycleFor, spreadDeficit, type Plan, type Spend } from "./budget";
import { formatMoney } from "./money";
import { weekday } from "./date";

const K = 100; // kobo per naira
const NGN = (n: number) => n * K;

// June 2026: 30 days, June 1 is a Monday. NGN 10,000/day spendable.
const plan: Plan = {
  salary: NGN(400_000),
  bills: [{ name: "Rent", amount: NGN(60_000) }],
  savingsPercent: 10,
  payday: 1,
};

describe("cycleFor", () => {
  it("clamps payday 31 to short months", () => {
    expect(cycleFor("2026-09-24", 31)).toEqual({ start: "2026-08-31", end: "2026-09-29" });
    expect(cycleFor("2026-09-30", 31)).toEqual({ start: "2026-09-30", end: "2026-10-30" });
    expect(cycleFor("2026-03-01", 31)).toEqual({ start: "2026-02-28", end: "2026-03-30" });
    expect(cycleFor("2028-02-29", 31)).toEqual({ start: "2028-02-29", end: "2028-03-30" });
  });

  it("crosses the year boundary", () => {
    expect(cycleFor("2026-12-31", 31)).toEqual({ start: "2026-12-31", end: "2027-01-30" });
    expect(cycleFor("2027-01-15", 25)).toEqual({ start: "2026-12-25", end: "2027-01-24" });
  });
});

describe("allocate", () => {
  it("sums exactly", () => {
    const out = allocate(1000, [7, 7, 7, 2]);
    expect(out.reduce((a, b) => a + b)).toBe(1000);
    expect(out).toEqual([305, 304, 304, 87]);
  });
});

describe("spreadDeficit", () => {
  it("refills from weeks with room when one hits its cap", () => {
    const { taken, leftover } = spreadDeficit(900, [1, 1, 1], [100, 500, 500]);
    expect(taken).toEqual([100, 400, 400]);
    expect(leftover).toBe(0);
  });
  it("returns what nobody could absorb", () => {
    expect(spreadDeficit(900, [1, 1], [100, 200]).leftover).toBe(600);
  });
});

describe("computeSnapshot", () => {
  it("splits the plan into calendar weeks", () => {
    const s = computeSnapshot(plan, [], "2026-06-01");
    expect(s.plan).toEqual({ salary: NGN(400_000), bills: NGN(60_000), savings: NGN(40_000), spendable: NGN(300_000) });
    expect(s.weeks.map((w) => [w.start, w.end, w.base])).toEqual([
      ["2026-06-01", "2026-06-07", NGN(70_000)],
      ["2026-06-08", "2026-06-14", NGN(70_000)],
      ["2026-06-15", "2026-06-21", NGN(70_000)],
      ["2026-06-22", "2026-06-28", NGN(70_000)],
      ["2026-06-29", "2026-06-30", NGN(20_000)],
    ]);
  });

  it("handles a partial first week on payday 31", () => {
    const s = computeSnapshot({ ...plan, payday: 31 }, [], "2026-09-24");
    const total = s.weeks.reduce((a, w) => a + w.days, 0);
    expect(total).toBe(30);
    expect(s.weeks.reduce((a, w) => a + w.base, 0)).toBe(s.plan.spendable);
    s.weeks.slice(0, -1).forEach((w) => expect(weekday(w.end)).toBe(6));
  });

  it("sweeps an underspent week into savings", () => {
    const spends: Spend[] = [{ amount: NGN(50_000), date: "2026-06-03" }];
    const s = computeSnapshot(plan, spends, "2026-06-10");
    expect(s.weeks[0]!.outcome).toEqual({ kind: "swept", amount: NGN(20_000) });
    expect(s.savings).toEqual({ planned: NGN(40_000), swept: NGN(20_000), borrowed: 0, net: NGN(60_000) });
    expect(s.weeks[1]!.budget).toBe(NGN(70_000));
  });

  it("spreads a small overspend across the remaining weeks", () => {
    const spends: Spend[] = [{ amount: NGN(80_000), date: "2026-06-05" }];
    const s = computeSnapshot(plan, spends, "2026-06-10");
    expect(s.weeks[0]!.outcome).toEqual({
      kind: "over",
      amount: NGN(10_000),
      spread: NGN(10_000),
      borrowed: 0,
      floorHit: false,
    });
    const later = s.weeks.slice(1);
    expect(later.reduce((a, w) => a + w.budget, 0)).toBe(NGN(230_000 - 10_000));
    later.forEach((w) => expect(w.budget).toBeGreaterThanOrEqual(w.floor));
  });

  it("borrows from savings past the 70% floor", () => {
    const spends: Spend[] = [{ amount: NGN(200_000), date: "2026-06-06" }];
    const s = computeSnapshot(plan, spends, "2026-06-10");
    // Room above the floor: 3 × 21,000 + 6,000 = 69,000 of a 130,000 deficit.
    expect(s.weeks[0]!.outcome).toEqual({
      kind: "over",
      amount: NGN(130_000),
      spread: NGN(69_000),
      borrowed: NGN(61_000),
      floorHit: true,
    });
    expect(s.weeks.slice(1).map((w) => w.budget)).toEqual([NGN(49_000), NGN(49_000), NGN(49_000), NGN(14_000)]);
    expect(s.savings.net).toBe(NGN(40_000 - 61_000));
  });

  // The last week never becomes "past" inside its own cycle; settling it is cycle close's job.
  it("shows a last-week overspend as negative room, not a spread", () => {
    const s = computeSnapshot(plan, [{ amount: NGN(25_000), date: "2026-06-29" }], "2026-06-30");
    expect(s.today.week.index).toBe(4);
    expect(s.today.leftThisWeek).toBe(NGN(-5_000));
    expect(s.today.spendToday).toBe(0);
  });

  it("gives a daily pace that today's spending draws down 1:1", () => {
    const spends: Spend[] = [
      { amount: NGN(70_000), date: "2026-06-03" },
      { amount: NGN(15_000), date: "2026-06-08" },
      { amount: NGN(5_000), date: "2026-06-09" },
      { amount: NGN(3_000), date: "2026-06-10" },
    ];
    const s = computeSnapshot(plan, spends, "2026-06-10");
    expect(s.today.daysLeftInWeek).toBe(5);
    expect(s.today.dailyPace).toBe(NGN(10_000));
    expect(s.today.spentToday).toBe(NGN(3_000));
    expect(s.today.spendToday).toBe(NGN(7_000));
    expect(s.today.leftThisWeek).toBe(NGN(47_000));
  });

  it("colors the week strip from real data", () => {
    const spends: Spend[] = [
      { amount: NGN(8_000), date: "2026-06-08" },
      { amount: NGN(14_000), date: "2026-06-09" },
    ];
    const s = computeSnapshot(plan, spends, "2026-06-10");
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

  it("marks days outside the cycle in a partial week", () => {
    const s = computeSnapshot(plan, [], "2026-06-30");
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

  it("flags plans where bills and savings exceed salary", () => {
    const s = computeSnapshot({ ...plan, bills: [{ name: "Rent", amount: NGN(390_000) }] }, [], "2026-06-10");
    expect(s.plan.spendable).toBe(0);
    expect(s.warnings).toContain("overcommitted");
    expect(s.today.spendToday).toBe(0);
  });

  it("ignores spends outside the cycle", () => {
    const s = computeSnapshot(plan, [{ amount: NGN(999_000), date: "2026-05-31" }], "2026-06-10");
    expect(s.weeks[0]!.outcome?.kind).toBe("swept");
  });
});

describe("formatMoney", () => {
  it("uses NGN with a non-breaking space", () => {
    expect(formatMoney(NGN(12_500))).toBe("NGN 12,500");
    expect(formatMoney(NGN(-5_000))).toBe("-NGN 5,000");
    expect(formatMoney(-20)).toBe("NGN 0");
  });
});
