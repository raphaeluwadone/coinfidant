/** "Sept", or "Sept 2027" when the date isn't in the current year. */
export function monthLabel(iso: string, month: "short" | "long", now = new Date()) {
  const date = new Date(`${iso}T00:00:00Z`);
  const year = date.getUTCFullYear() === now.getFullYear() ? undefined : "numeric";
  return date.toLocaleDateString("en-GB", { timeZone: "UTC", month, year });
}
