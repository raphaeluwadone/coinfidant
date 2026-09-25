import { describe, expect, it } from "vitest";
import { computeBadges, currentStreak, type GrowthInput, longestStreak, rateTrend } from "./badges";
import type { ClosedCycle, Week } from "./types";

const week = (outcome: Week["outcome"]): Week =>
  ({ index: 0, start: "", end: "", days: 7, base: 0, floor: 0, budget: 0, spent: 1, status: "past", outcome }) as Week;
const swept = week({ kind: "swept", amount: 1, to: "savings" });
const floor = week({ kind: "over", amount: 5, spread: 1, borrowed: 4, floorHit: true });
const cycle = (weeks: Week[], net: number) => ({ weeks, savings: { net } }) as unknown as ClosedCycle;

const base: GrowthInput = { today: "2026-09-25", closed: [], open: null, logs: [], debtsCleared: 0, goalsReached: 0 };
const earned = (g: Partial<GrowthInput>) =>
  computeBadges({ ...base, ...g })
    .filter((b) => b.earned)
    .map((b) => b.key);

describe("streaks", () => {
  it("counts back from today, or from yesterday before today's first log", () => {
    const days = ["2026-09-22", "2026-09-23", "2026-09-24"];
    expect(currentStreak(days, "2026-09-25")).toBe(3);
    expect(currentStreak([...days, "2026-09-25"], "2026-09-25")).toBe(4);
    expect(currentStreak(["2026-09-20"], "2026-09-25")).toBe(0);
  });

  it("finds the longest run ever", () => {
    expect(longestStreak(["2026-01-01", "2026-01-02", "2026-01-05", "2026-01-06", "2026-01-07", "2026-01-06"])).toBe(3);
    expect(longestStreak([])).toBe(0);
  });
});

describe("badges", () => {
  it("nothing earned on day one", () => {
    expect(earned({})).toEqual([]);
  });

  it("an empty week's sweep doesn't count", () => {
    const idle = { ...swept, spent: 0 };
    expect(earned({ closed: [cycle([idle, idle, idle, idle], 1)] })).not.toContain("sweepLord");
  });

  it("Sweep Lord needs 4 swept weeks in one cycle", () => {
    expect(earned({ closed: [cycle([swept, swept, swept], 1), cycle([swept], 1)] })).not.toContain("sweepLord");
    expect(earned({ closed: [cycle([swept, swept, swept, swept], 1)] })).toContain("sweepLord");
  });

  it("Floor Is Lava Survivor needs a floor hit in a cycle that still saved", () => {
    expect(earned({ closed: [cycle([floor], -10)] })).not.toContain("floorIsLava");
    expect(earned({ closed: [cycle([floor], 10)] })).toContain("floorIsLava");
  });

  it("7-Day Streak Goblin, Goal Getter and Debt Slayer", () => {
    const logs = Array.from({ length: 7 }, (_, i) => ({ date: `2026-09-0${i + 1}`, hour: 12 }));
    expect(earned({ logs, goalsReached: 1, debtsCleared: 1 })).toEqual(["streak7", "goalGetter", "debtSlayer"]);
  });

  it("Night Owl Saver needs 10 evening logs and a swept week", () => {
    const logs = Array.from({ length: 10 }, () => ({ date: "2026-09-01", hour: 21 }));
    expect(earned({ logs })).not.toContain("nightOwl");
    expect(earned({ logs, closed: [cycle([swept], 1)] })).toContain("nightOwl");
  });

  it("Slow & Steady needs 3 saving cycles in a row", () => {
    expect(earned({ closed: [cycle([], 1), cycle([], -1), cycle([], 1), cycle([], 1)] })).not.toContain("slowSteady");
    expect(earned({ closed: [cycle([], 1), cycle([], 1), cycle([], 1)] })).toContain("slowSteady");
  });
});

describe("rateTrend", () => {
  it("compares the latest rate with the average before it", () => {
    expect(rateTrend([900, 1200, 1100, 1800])).toBe("up");
    expect(rateTrend([1800, 1700, 900])).toBe("down");
    expect(rateTrend([1000, 1050])).toBe("flat");
    expect(rateTrend([1000])).toBe("flat");
  });
});
