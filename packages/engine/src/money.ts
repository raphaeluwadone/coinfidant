/** Amounts are integer minor units (kobo for NGN). */
export type Minor = number;

export type CurrencyCode = "NGN" | "USD" | "GBP" | "EUR";

const NBSP = " ";

export function formatMoney(amount: Minor, currency: CurrencyCode = "NGN", opts: { showMinor?: boolean } = {}): string {
  const major = Math.abs(amount) / 100;
  const digits = opts.showMinor ? 2 : 0;
  const n = new Intl.NumberFormat("en-NG", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(
    opts.showMinor ? major : Math.round(major),
  );
  const sign = amount < 0 && n !== "0" ? "-" : "";
  return `${sign}${currency}${NBSP}${n}`;
}

export function toMinor(major: number): Minor {
  return Math.round(major * 100);
}
