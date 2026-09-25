import { describe, expect, it } from "vitest";
import {
  coachFocus,
  coachPace,
  coachPayload,
  coachSystemPrompt,
  type CoachInput,
  cycleCoachPace,
  cycleCoachPayload,
  tidyCoachReview,
} from "./coach";
import { closeCycle, computeOpenCycle } from "./cycle";
import type { DiscoveryTxn } from "./discovery";
import type { EngineInput } from "./types";
import { TONES } from "./voice";

const NGN = (n: number) => n * 100;

// June 2026: Monday starts, NGN 10,000 a day, NGN 70,000 a week.
const engine = (today: string, txns: DiscoveryTxn[]): EngineInput => ({
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
  transactions: txns.map((t, k) => ({ id: String(k), amount: t.amount, date: t.date, type: t.type })),
  sweepChoices: {},
  debtPayments: [],
});

const spend = (date: string, amount: number, categoryId = "food", type: "spend" | "refund" = "spend") => ({
  date,
  amount: NGN(amount),
  type,
  categoryId,
});

const money = (n: number) => `NGN ${(n / 100).toLocaleString("en-GB")}`;

const input = (today: string, txns: DiscoveryTxn[], o: Partial<CoachInput> = {}): CoachInput => ({
  open: computeOpenCycle(engine(today, txns)),
  txns,
  categories: [
    { id: "food", name: "Food" },
    { id: "fun", name: "Fun" },
  ],
  tone: "cheeky",
  phase: "build",
  discovery: false,
  target: null,
  previous: null,
  money,
  ...o,
});

describe("R28 coach", () => {
  it("reviews last week on a week's first day, this week after that", () => {
    expect(coachFocus(input("2026-06-08", []).open)).toMatchObject({ week: { index: 0 }, inProgress: false });
    expect(coachFocus(input("2026-06-09", []).open)).toMatchObject({ week: { index: 1 }, inProgress: true });
  });

  it("decides pace from the numbers, not the model", () => {
    // Wednesday of week 2: three days in, NGN 30,000 expected.
    expect(coachPace(input("2026-06-10", [spend("2026-06-08", 10_000)]).open)).toBe("ahead");
    expect(coachPace(input("2026-06-10", [spend("2026-06-08", 29_000)]).open)).toBe("onPace");
    expect(coachPace(input("2026-06-10", [spend("2026-06-08", 40_000)]).open)).toBe("behind");
    expect(coachPace(input("2026-06-08", [spend("2026-06-03", 90_000)]).open)).toBe("behind");
  });

  it("sends aggregates only, with money pre-formatted", () => {
    const txns = [
      spend("2026-06-08", 9_000),
      spend("2026-06-09", 3_000, "fun"),
      spend("2026-06-09", 1_000, "food", "refund"),
    ];
    const p = coachPayload(input("2026-06-10", txns));
    expect(p.focus).toMatchObject({ label: "this week so far", spent: "NGN 11,000", daysDone: 3 });
    expect(p.focus.categories).toEqual([
      { category: "Food", spent: "NGN 8,000", share: "73%" },
      { category: "Fun", spent: "NGN 3,000", share: "27%" },
    ]);
    const json = JSON.stringify(p);
    expect(json).not.toMatch(/2026-06-0[89]/);
    expect(json).not.toMatch(/"amount":\d/);
  });

  it("carries the previous target forward so the review can reference it", () => {
    const previous = {
      weekIndex: 0,
      sameCycle: true,
      pace: "behind" as const,
      review: {
        verdict: { label: "Behind", line: "x" },
        lever: "x",
        target: "Keep Food under NGN 40,000",
        observation: "x",
      },
    };
    const p = coachPayload(input("2026-06-10", [], { previous }));
    expect(p.previousReview).toEqual({ when: "last week", pace: "behind", target: "Keep Food under NGN 40,000" });
  });

  it("briefs every tone and keeps the house rules", () => {
    for (const t of TONES) {
      const prompt = coachSystemPrompt(t.key);
      expect(prompt).toMatch(/Never joke about debt/);
      expect(prompt).not.toContain(String.fromCharCode(0x2014));
    }
  });

  it("tidies em dashes out of model output", () => {
    const dash = String.fromCharCode(0x2014);
    const r = tidyCoachReview({
      verdict: { label: "Ahead", line: `Nice ${dash} really` },
      lever: `Food ${dash}big`,
      target: "t",
      observation: "o",
    });
    expect(r.verdict.line).toBe("Nice, really");
    expect(r.lever).toBe("Food, big");
  });

  it("grades a closed cycle from its savings, not the model", () => {
    const june = (txns: DiscoveryTxn[]) => closeCycle(engine("2026-06-30", txns), "2026-07-01");
    expect(cycleCoachPace(june([spend("2026-06-02", 100_000)]))).toBe("ahead");
    // Every week spent exactly to plan: nothing swept, nothing borrowed.
    const toPlan = june([]);
    const weeks = toPlan.weeks.map((w) => spend(w.start, w.budget / 100));
    expect(cycleCoachPace(june(weeks))).toBe("onPace");
    expect(cycleCoachPace(june([spend("2026-06-29", 300_000)]))).toBe("behind");
  });

  it("builds a cycle payload with the rate up front and no raw spends", () => {
    const txns = [spend("2026-06-02", 50_000), spend("2026-06-20", 20_000, "fun")];
    const p = cycleCoachPayload({
      closed: closeCycle(engine("2026-06-30", txns), "2026-07-01"),
      txns,
      categories: [
        { id: "food", name: "Food" },
        { id: "fun", name: "Fun" },
      ],
      tone: "gentle",
      phase: "attack",
      discovery: false,
      pending: [{ name: "OPay", unpaid: NGN(5_000) }],
      previous: null,
      money,
    });
    expect(p).toMatchObject({ kind: "cycle", spent: "NGN 70,000", stillOwed: [{ name: "OPay", unpaid: "NGN 5,000" }] });
    expect(p.savings.rate).toMatch(/%$/);
    expect(p.categories.map((c) => c.category)).toEqual(["Food", "Fun"]);
    expect(JSON.stringify(p)).not.toMatch(/2026-06-(02|20)/);
  });

  it("asks for a next-cycle target in a wrap-up", () => {
    expect(coachSystemPrompt("cheeky", "cycle")).toMatch(/coming pay cycle/);
    expect(coachSystemPrompt("cheeky")).toMatch(/coming week/);
  });
});
