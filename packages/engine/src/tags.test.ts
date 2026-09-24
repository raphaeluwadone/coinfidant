import { describe, expect, it } from "vitest";
import { autoTag, type TaggableSpend } from "./tags";

const ctx = { timeZone: "Africa/Lagos", dailyPace: 1_000_000 };
let n = 0;
// Lagos is UTC+1, so 09:00Z is 10:00 local.
const spend = (localDate: string, amount: number, category = "food", hourZ = 9): TaggableSpend => ({
  id: String(++n).padStart(4, "0"),
  amount,
  category,
  localDate,
  occurredAt: `${localDate}T${String(hourZ).padStart(2, "0")}:00:00.000Z`,
});

describe("autoTag", () => {
  // 2026-06-08 is a Monday.
  it("counts repeats in the same category this week", () => {
    const a = spend("2026-06-08", 150_000);
    const b = spend("2026-06-09", 150_000);
    const c = spend("2026-06-10", 150_000);
    const history = [a, b, c, spend("2026-06-10", 999, "transport")];
    expect(autoTag(c, history, ctx)).toBe("3rd food run this week");
    expect(autoTag(b, history, ctx)).toBe("2nd food run this week");
    expect(autoTag(a, history, ctx)).toBe("Fuel for the soul");
  });

  it("doesn't count last week's spends", () => {
    const old = [spend("2026-06-05", 100), spend("2026-06-06", 100)];
    const now = spend("2026-06-08", 100);
    expect(autoTag(now, [...old, now], ctx)).toBe("Fuel for the soul");
  });

  it("spots round numbers, late nights, big spends and weekends", () => {
    const round = spend("2026-06-09", 2_000_000, "shopping");
    expect(autoTag(round, [round], ctx)).toBe("Suspiciously round number");
    const late = spend("2026-06-09", 12_345, "fun", 22);
    expect(autoTag(late, [late], ctx)).toBe("Late-night decision");
    const big = spend("2026-06-09", 1_234_500, "home");
    expect(autoTag(big, [big], ctx)).toBe("Big spend energy");
    const sat = spend("2026-06-13", 12_345, "transport");
    expect(autoTag(sat, [sat], ctx)).toBe("Weekend mode");
  });
});
