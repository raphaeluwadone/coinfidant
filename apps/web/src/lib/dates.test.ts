import { describe, expect, it } from "vitest";
import { monthLabel } from "./dates";

describe("monthLabel", () => {
  const now = new Date("2026-09-29T12:00:00Z");

  it("leaves the year off this year's months", () => {
    expect(monthLabel("2026-12-01", "short", now)).toBe("Dec");
  });

  it("adds the year for other years", () => {
    expect(monthLabel("2027-09-17", "short", now)).toBe("Sept 2027");
    expect(monthLabel("2027-09-17", "long", now)).toBe("September 2027");
  });
});
