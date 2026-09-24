import type { Minor } from "./money";

/** Splits `total` across `weights` in integers that sum exactly to `total` (largest remainder). */
export function allocate(total: Minor, weights: number[]): Minor[] {
  if (weights.length === 0) return [];
  const sum = weights.reduce((a, b) => a + b, 0);
  const w = sum > 0 ? weights : weights.map(() => 1);
  const wSum = sum > 0 ? sum : weights.length;
  const raw = w.map((x) => (total * x) / wSum);
  const out = raw.map(Math.floor);
  let rest = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rest > 0; k = (k + 1) % order.length, rest--) out[order[k]![1]]! += 1;
  return out;
}

/** Spreads `amount` across weeks in proportion to `weights`, never taking more than each week's `caps`. */
export function spreadDeficit(amount: Minor, weights: number[], caps: Minor[]) {
  const taken = caps.map(() => 0);
  let remaining = amount;
  let active = caps.map((_, i) => i).filter((i) => caps[i]! > 0);
  while (remaining > 0 && active.length > 0) {
    const shares = allocate(
      remaining,
      active.map((i) => weights[i]!),
    );
    let absorbed = 0;
    active.forEach((i, k) => {
      const t = Math.min(shares[k]!, caps[i]! - taken[i]!);
      taken[i]! += t;
      absorbed += t;
    });
    remaining -= absorbed;
    active = active.filter((i) => taken[i]! < caps[i]!);
    if (absorbed === 0) break;
  }
  return { taken, leftover: remaining };
}
