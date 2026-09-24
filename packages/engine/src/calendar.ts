import { addDays, daysBetween, daysInMonth, type ISODate, weekday } from "./date";

export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function paydayIn(year: number, month1: number, payday: number): ISODate {
  const day = Math.min(payday, daysInMonth(year, month1));
  return `${year}-${String(month1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export const shiftMonth = (y: number, m: number, by: number) => {
  const i = y * 12 + (m - 1) + by;
  return [Math.floor(i / 12), (i % 12) + 1] as const;
};

const ym = (d: ISODate) => d.split("-").map(Number) as [number, number];

/** The expected payday closest to `date`, since salary can land a few days either side of it. */
export function nearestPayday(date: ISODate, payday: number) {
  const [y, m] = ym(date);
  let best = { y, m, date: paydayIn(y, m, payday) };
  for (const by of [-1, 1]) {
    const [cy, cm] = shiftMonth(y, m, by);
    const cand = paydayIn(cy, cm, payday);
    if (Math.abs(daysBetween(cand, date)) < Math.abs(daysBetween(best.date, date))) best = { y: cy, m: cm, date: cand };
  }
  return best;
}

/** R2: the day before the payday after the one this cycle's salary belongs to. */
export function projectedEnd(start: ISODate, payday: number): ISODate {
  const { y, m } = nearestPayday(start, payday);
  const [ny, nm] = shiftMonth(y, m, 1);
  return addDays(paydayIn(ny, nm, payday), -1);
}

/** Expected paydays after this cycle's own, strictly before `until`. */
export function laterPaydays(start: ISODate, payday: number, until: ISODate): ISODate[] {
  const { y, m } = nearestPayday(start, payday);
  const out: ISODate[] = [];
  for (let i = 1; ; i++) {
    const [ny, nm] = shiftMonth(y, m, i);
    const p = paydayIn(ny, nm, payday);
    if (p >= until) return out;
    out.push(p);
  }
}

/** Where a cycle would start if salary landed exactly on the expected payday. */
export function cycleStartFor(today: ISODate, payday: number): ISODate {
  const [y, m] = ym(today);
  const thisPayday = paydayIn(y, m, payday);
  if (today >= thisPayday) return thisPayday;
  const [py, pm] = shiftMonth(y, m, -1);
  return paydayIn(py, pm, payday);
}

/** Position of `d` in a week that starts on `weekStart` (0 = Monday). */
export const dayOfWeek = (d: ISODate, weekStart: WeekStart) => (weekday(d) - weekStart + 7) % 7;

export function splitWeeks(start: ISODate, end: ISODate, weekStart: WeekStart) {
  const weeks: { start: ISODate; end: ISODate; days: number }[] = [];
  let s = start;
  while (s <= end) {
    const last = addDays(s, 6 - dayOfWeek(s, weekStart));
    const e = last < end ? last : end;
    weeks.push({ start: s, end: e, days: daysBetween(s, e) + 1 });
    s = addDays(e, 1);
  }
  return weeks;
}
