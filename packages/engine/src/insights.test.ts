import { describe, expect, it } from "vitest";
import { computeOpenCycle } from "./cycle";
import type { DiscoveryTxn } from "./discovery";
import { generateInsights, INSIGHT_EMOJI, type InsightInput, insightText } from "./insights";
import { linesFor, type Tone } from "./voice";
import type { EngineInput } from "./types";

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

const spend = (date: string, amount: number, categoryId = "food"): DiscoveryTxn => ({
  date,
  amount: NGN(amount),
  type: "spend",
  categoryId,
});

const categories = [
  { id: "food", name: "Food", emoji: "🍜" },
  { id: "fun", name: "Fun", emoji: "🎉" },
];

const run = (today: string, txns: DiscoveryTxn[], o: Partial<InsightInput> = {}) =>
  generateInsights({
    open: computeOpenCycle(engine(today, txns)),
    txns,
    categories,
    streak: 0,
    lastLogged: txns.length
      ? txns
          .map((t) => t.date)
          .sort()
          .at(-1)!
      : null,
    discovery: false,
    target: null,
    ...o,
  });

const keys = (xs: { key: string }[]) => xs.map((x) => x.key);

describe("R27 insights", () => {
  it("praises being under pace and calls out being over it", () => {
    // Wednesday of week 2: two days done, NGN 20,000 expected.
    expect(keys(run("2026-06-10", [spend("2026-06-08", 5_000)]))).toContain("ahead");
    const over = run("2026-06-10", [spend("2026-06-08", 30_000)]);
    expect(over[0]).toMatchObject({ key: "behind", severity: "warn", vars: { amount: NGN(10_000) } });
  });

  it("mentions last week's sweep, spread or borrow", () => {
    expect(run("2026-06-10", [spend("2026-06-03", 50_000)]).find((x) => x.key === "swept")?.vars.amount).toBe(
      NGN(20_000),
    );
    expect(keys(run("2026-06-10", [spend("2026-06-03", 80_000)]))).toContain("spread");
    expect(keys(run("2026-06-10", [spend("2026-06-03", 200_000)]))).toContain("borrowed");
  });

  it("an untouched last week isn't worth a sweep insight", () => {
    expect(keys(run("2026-06-10", [spend("2026-06-08", 10_000)]))).not.toContain("swept");
  });

  it("flags a category taking most of the week", () => {
    const txns = [spend("2026-06-08", 9_000), spend("2026-06-09", 8_000), spend("2026-06-09", 1_000, "fun")];
    const x = run("2026-06-10", txns).find((i) => i.key === "category");
    expect(x?.vars).toEqual({ emoji: "🍜", name: "Food", percent: "94%" });
  });

  it("spots a hot weekday once the cycle is long enough", () => {
    const fridays = ["2026-06-05", "2026-06-12"].map((d) => spend(d, 20_000, "fun"));
    const others = ["2026-06-02", "2026-06-03", "2026-06-09", "2026-06-10"].map((d) => spend(d, 1_000));
    expect(run("2026-06-15", [...fridays, ...others]).find((x) => x.key === "weekday")?.vars.day).toBe("Friday");
  });

  it("nudges after a quiet spell and notes payday approaching", () => {
    expect(keys(run("2026-06-10", [spend("2026-06-06", 1_000)]))).toContain("gap");
    expect(keys(run("2026-06-29", [spend("2026-06-28", 1_000), spend("2026-06-29", 1_000)]))).toContain("payday");
  });

  it("keeps discovery judgment-free", () => {
    const x = run("2026-06-10", [spend("2026-06-08", 30_000)], { discovery: true, streak: 5 });
    expect(keys(x)).not.toContain("behind");
    expect(keys(x)).not.toContain("streak");
  });

  it("shows 2–3, and rotates away from recently shown ones", () => {
    const txns = [spend("2026-06-03", 50_000), spend("2026-06-08", 30_000), spend("2026-06-09", 1_000)];
    const first = run("2026-06-10", txns, { streak: 4, target: { name: "OPay", amountLeft: NGN(88_000) } });
    expect(first.length).toBeGreaterThanOrEqual(2);
    expect(first.length).toBeLessThanOrEqual(3);
    const next = run("2026-06-10", txns, {
      streak: 4,
      target: { name: "OPay", amountLeft: NGN(88_000) },
      recent: keys(first) as InsightInput["recent"],
    });
    expect(next.length).toBeGreaterThanOrEqual(2);
    expect(keys(next).filter((k) => keys(first).includes(k)).length).toBeLessThan(first.length);
  });

  it("turns an insight into words in the chosen tone", () => {
    const [x] = run("2026-06-10", [spend("2026-06-08", 30_000)]);
    const money = (n: number) => `NGN ${n / 100}`;
    expect(insightText(x!, "gentle", money)).toBe("You're NGN 10000 over this week's pace. Easing off helps.");
    expect(insightText(x!, "unhinged", money)).toBe("NGN 10000 OVER PACE. BRAKES. NOW 😬");
  });

  it("never repeats the icon the card already shows", () => {
    const tones: Tone[] = ["gentle", "cheeky", "unhinged"];
    for (const [key, icon] of Object.entries(INSIGHT_EMOJI))
      for (const tone of tones)
        for (const line of linesFor(`insight.${key}` as Parameters<typeof linesFor>[0], tone))
          expect(line.includes(icon), `insight.${key} ${tone}: ${line}`).toBe(false);
    // The category icon is the category's own emoji, so its lines don't carry one.
    for (const tone of tones)
      for (const line of linesFor("insight.category", tone)) expect(line).not.toContain("{emoji}");
  });
});
