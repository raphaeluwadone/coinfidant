import { describe, expect, it } from "vitest";
import { autoTag } from "./tags";
import { linesFor, say, stakesHigh, type Tone, VOICE, type VoiceKey } from "./voice";

const keys = Object.keys(VOICE) as VoiceKey[];
const EM_DASH = String.fromCharCode(0x2014);
const emoji = /\p{Extended_Pictographic}/gu;
const emojiCount = (s: string) => s.replace(/\{\w+\}/g, "").match(emoji)?.length ?? 0;
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("voice pools", () => {
  it("every key moment has lines at all three levels, or is deliberately warm", () => {
    for (const k of keys) {
      const pool = VOICE[k] as { gentle: string[]; cheeky?: string[]; unhinged?: string[]; warm?: true };
      expect(pool.gentle.length, k).toBeGreaterThan(0);
      if (pool.warm) {
        expect(pool.cheeky, `${k} is warm, so it has no cheeky lines`).toBeUndefined();
        expect(pool.unhinged, `${k} is warm, so it has no unhinged lines`).toBeUndefined();
      } else {
        expect(pool.cheeky?.length, `${k} cheeky`).toBeGreaterThan(0);
        expect(pool.unhinged?.length, `${k} unhinged`).toBeGreaterThan(0);
      }
    }
  });

  it("debt and savings drains are never joked about", () => {
    const serious: VoiceKey[] = [
      "week.floorHit",
      "event.borrowed",
      "today.overcommitted",
      "onboarding.debts.none",
      "onboarding.debts.some",
      "onboarding.debts.many",
      "onboarding.bills.heavy",
    ];
    for (const k of serious) expect((VOICE[k] as { warm?: true }).warm, k).toBe(true);
  });

  it("emoji density scales with the dial", () => {
    for (const k of keys) {
      const pool = VOICE[k] as Record<Tone, string[] | undefined>;
      for (const line of pool.gentle ?? []) expect(emojiCount(line), `${k} gentle: ${line}`).toBeLessThanOrEqual(1);
      for (const line of pool.unhinged ?? [])
        expect(emojiCount(line), `${k} unhinged: ${line}`).toBeGreaterThanOrEqual(1);
    }
  });

  it("uses the same placeholders at every level", () => {
    for (const k of keys) {
      const pool = VOICE[k] as Record<Tone, string[] | undefined>;
      const sets = (["gentle", "cheeky", "unhinged"] as Tone[])
        .flatMap((t) => pool[t] ?? [])
        .map((l) => placeholders(l).join(","));
      expect(new Set(sets).size, k).toBe(1);
    }
  });

  it("has no em dashes", () => {
    for (const k of keys) {
      for (const line of Object.values(VOICE[k]).flat()) {
        if (typeof line === "string") expect(line.includes(EM_DASH), `${k}: ${line}`).toBe(false);
      }
    }
  });
});

describe("say", () => {
  it("fills placeholders", () => {
    expect(say("sweep.savings", "cheeky", { amount: "NGN 4,200" })).toBe(
      "NGN 4,200 swept into savings. Future you just did a little dance 💃",
    );
  });

  it("falls back toward Gentle for warm moments", () => {
    expect(say("event.borrowed", "unhinged", { amount: "NGN 5,000" })).toBe(
      "NGN 5,000 came from savings to cover a heavy week. We'll steady things from here.",
    );
  });

  it("the stakes override gives every level the warm voice", () => {
    expect(linesFor("today.fresh", "unhinged", { stakes: true })).toEqual(VOICE["today.fresh"].gentle);
  });

  it("rotates by seed and skips recently shown lines", () => {
    const lines = linesFor("today.fresh", "cheeky");
    expect(say("today.fresh", "cheeky", {}, { seed: 1 })).toBe(lines[1]);
    expect(say("today.fresh", "cheeky", {}, { seed: 0, avoid: [lines[0]!] })).toBe(lines[1]);
    expect(say("today.fresh", "cheeky", {}, { seed: 5, avoid: lines })).toBe(lines[5 % lines.length]);
  });
});

describe("stakesHigh", () => {
  const borrowed = { type: "borrowedFromSavings" as const, week: 0, amount: 1 };
  it("trips on repeated savings drains or an overcommitted plan", () => {
    expect(stakesHigh({ events: [borrowed] })).toBe(false);
    expect(stakesHigh({ events: [borrowed, { ...borrowed, week: 1 }] })).toBe(true);
    expect(stakesHigh({ events: [borrowed] }, { borrowedLastCycle: true })).toBe(true);
    expect(stakesHigh({ events: [{ type: "overcommitted", shortfall: 1 }] })).toBe(true);
  });
});

describe("tone-aware tags", () => {
  const spend = {
    id: "1",
    amount: 12_345,
    category: "food",
    occurredAt: "2026-06-09T09:00:00.000Z",
    localDate: "2026-06-09",
  };
  it("speaks in the chosen tone", () => {
    const ctx = { timeZone: "Africa/Lagos", dailyPace: 1_000_000 };
    expect(autoTag(spend, [spend], { ...ctx, tone: "gentle" })).toBe("A meal");
    expect(autoTag(spend, [spend], ctx)).toBe("Fuel for the soul");
    expect(autoTag(spend, [spend], { ...ctx, tone: "unhinged" })).toBe("FUEL FOR THE SOUL 🍜");
  });
});
