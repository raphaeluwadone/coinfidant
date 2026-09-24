/** Calendar date in the user's timezone, `YYYY-MM-DD`. The engine never sees instants. */
export type ISODate = string;

const DAY_MS = 86_400_000;

export function toDayNum(d: ISODate): number {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y!, m! - 1, day!) / DAY_MS;
}

export function fromDayNum(n: number): ISODate {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

export const addDays = (d: ISODate, n: number): ISODate => fromDayNum(toDayNum(d) + n);

export const daysBetween = (from: ISODate, to: ISODate): number => toDayNum(to) - toDayNum(from);

/** 0 = Monday … 6 = Sunday. */
export const weekday = (d: ISODate): number => (new Date(toDayNum(d) * DAY_MS).getUTCDay() + 6) % 7;

export const daysInMonth = (year: number, month1: number): number => new Date(Date.UTC(year, month1, 0)).getUTCDate();

export function localDate(instant: Date, timeZone: string): ISODate {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    instant,
  );
}
