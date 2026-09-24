import { describe, expect, it } from "vitest";
import { fromMinorUnits, press, toMinorUnits, type Key } from "./amount";

const type = (keys: Key[]) => keys.reduce(press, "");

describe("keypad amount", () => {
  it("builds amounts and caps decimals at two", () => {
    expect(type(["8", ".", "5"])).toBe("8.5");
    expect(type(["8", ".", "5", "0", "9"])).toBe("8.50");
    expect(type([".", "5"])).toBe("0.5");
    expect(type(["1", ".", "."])).toBe("1.");
  });

  it("drops leading zeros and handles backspace", () => {
    expect(type(["0", "0", "7"])).toBe("7");
    expect(type(["1", "2", "back"])).toBe("1");
    expect(type(["back"])).toBe("");
  });

  it("caps the integer part", () => {
    expect(type(Array(12).fill("9") as Key[])).toBe("999999999");
  });

  it("converts to and from minor units without float drift", () => {
    expect(toMinorUnits("8.5")).toBe(850);
    expect(toMinorUnits("0.29")).toBe(29);
    expect(toMinorUnits("1.")).toBe(100);
    expect(toMinorUnits("")).toBe(0);
    expect(fromMinorUnits(850)).toBe("8.5");
    expect(fromMinorUnits(250_000)).toBe("2500");
    expect(fromMinorUnits(1_207)).toBe("12.07");
  });
});
