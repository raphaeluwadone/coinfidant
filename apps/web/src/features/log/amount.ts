import type { Minor } from "@coinfidant/engine";

export type Key = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "." | "back";

const MAX_INT_DIGITS = 9;

/** Applies one keypad press to the typed amount string, e.g. "8.5". */
export function press(value: string, key: Key): string {
  if (key === "back") return value.slice(0, -1);
  const [int = "", frac] = value.split(".");
  if (key === ".") return frac !== undefined ? value : (int || "0") + ".";
  if (frac !== undefined) return frac.length >= 2 ? value : value + key;
  if (int === "0") return key;
  return int.length >= MAX_INT_DIGITS ? value : value + key;
}

export function toMinorUnits(value: string): Minor {
  const [int = "", frac = ""] = value.split(".");
  return Number(int || 0) * 100 + Number(frac.padEnd(2, "0").slice(0, 2));
}

export function fromMinorUnits(amount: Minor): string {
  const int = Math.floor(amount / 100);
  const frac = amount % 100;
  return frac ? `${int}.${String(frac).padStart(2, "0").replace(/0$/, "")}` : String(int);
}
