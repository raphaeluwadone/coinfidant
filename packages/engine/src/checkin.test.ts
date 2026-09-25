import { describe, expect, it } from "vitest";
import { checkinMessage, tomorrowAllowance } from "./checkin";
import { computeOpenCycle } from "./cycle";
import type { EngineInput } from "./types";

const NGN = (n: number) => n * 100;
const money = (n: number) => `NGN ${(n / 100).toLocaleString("en-GB")}`;

// June 2026: Monday starts, NGN 10,000 a day, NGN 70,000 a week.
const open = (today: string, spent: [string, number][] = []) =>
  computeOpenCycle({
    today,
    settings: {
      savingsPercent: 10,
      minSavingsPercent: 5,
      floorPercent: 70,
      weekStart: 0,
      expectedPayday: 1,
      everydayEstimate: null,
      leftoverDefault: "savings",
    },
    cycle: { start: "2026-06-01", salary: NGN(400_000) },
    bills: [{ id: "rent", name: "Rent", amount: NGN(60_000) }],
    sinkingFunds: [],
    debts: [],
    commitments: [],
    transactions: spent.map(([date, n], k) => ({ id: String(k), amount: NGN(n), date, type: "spend" })),
    sweepChoices: {},
    debtPayments: [],
  } satisfies EngineInput);

describe("R29 check-ins", () => {
  it("spreads what's left of the week over the days after today", () => {
    // Wednesday: NGN 20,000 spent of 70,000, so 50,000 over Thursday to Sunday.
    expect(tomorrowAllowance(open("2026-06-10", [["2026-06-08", 20_000]]))).toBe(NGN(12_500));
    // Sunday: tomorrow starts a fresh week.
    expect(tomorrowAllowance(open("2026-06-14"))).toBe(NGN(10_000));
  });

  it("evening always nudges, drift only when the week is off", () => {
    const calm = open("2026-06-10", [["2026-06-08", 20_000]]);
    expect(checkinMessage(calm, "evening", "gentle", money)?.body).toBe(
      "Evening. Anything to log today? You have NGN 12,500 for tomorrow.",
    );
    expect(checkinMessage(calm, "drift", "gentle", money)).toBeNull();
    expect(checkinMessage(calm, "app", "gentle", money)).toBeNull();

    const over = open("2026-06-10", [["2026-06-08", 80_000]]);
    expect(checkinMessage(over, "drift", "gentle", money)?.body).toBe(
      "This week is NGN 10,000 over plan. A quiet day tomorrow brings it back.",
    );
  });
});
