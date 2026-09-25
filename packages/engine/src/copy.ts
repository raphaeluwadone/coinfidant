import type { OpenCycle, WeekOutcome } from "./types";

export type Tone = "gentle" | "cheeky" | "unhinged";

export const TONES: { key: Tone; label: string; emoji: string }[] = [
  { key: "gentle", label: "Gentle", emoji: "😌" },
  { key: "cheeky", label: "Cheeky", emoji: "😏" },
  { key: "unhinged", label: "Unhinged", emoji: "🤪" },
];

export type TodayMood = "fresh" | "onTrack" | "tight" | "spentOut" | "overWeek" | "overcommitted";

const QUIPS: Record<TodayMood, Record<Tone, string[]>> = {
  fresh: {
    gentle: ["A clean slate today.", "Nothing spent yet. Nice and calm."],
    cheeky: ["Your wallet is doing yoga 🧘", "Untouched. Suspiciously disciplined.", "Zero spent. Who even are you?"],
    unhinged: ["WALLET IN MINT CONDITION 🧘✨", "Not a single naira moved. Legendary behaviour 🗿🔥"],
  },
  onTrack: {
    gentle: ["You're right on pace.", "Steady does it."],
    cheeky: [
      "Right on pace. Smooth operator 😎",
      "Spending like someone with a plan.",
      "Budget's comfy. Keep it that way.",
    ],
    unhinged: ["PACE: IMMACULATE 😎📈", "The budget and you? Besties. Matching bracelets 💅"],
  },
  tight: {
    gentle: ["A little tight today, and that's okay.", "Going easy for the rest of the day helps."],
    cheeky: ["Getting cosy in here. Maybe skip the extra snack 👀", "Tight, not tragic."],
    unhinged: ["WE ARE IN THE DANGER ZONE 🚨 (it's fine, mostly)", "Wallet is sweating. Put the snack DOWN 👀🥵"],
  },
  spentOut: {
    gentle: ["Today's share is used up. Tomorrow resets.", "That's today done. You've got this."],
    cheeky: ["Today's budget has left the chat 👋", "That's a wrap for today's money."],
    unhinged: ["TODAY'S MONEY HAS LEFT THE BUILDING 🏃💨", "Budget: gone. Vibes: surviving 🫠"],
  },
  overWeek: {
    gentle: ["This week ran over. We'll spread it gently across the next ones.", "A heavier week. The plan adjusts."],
    cheeky: ["This week got a bit spicy 🌶️ We'll smooth it out.", "Over for the week. Future weeks are chipping in."],
    unhinged: [
      "THIS WEEK WENT FERAL 🌶️🔥 future weeks are sending help",
      "We overspent. We're not proud. We're adapting 🦎",
    ],
  },
  overcommitted: {
    gentle: ["Bills and savings are more than your pay. Let's adjust the plan."],
    cheeky: ["The maths isn't mathing. Bills plus savings beat your pay 🧮"],
    unhinged: ["THE NUMBERS ARE FIGHTING 🧮🥊 bills + savings > pay"],
  },
};

export function todayMood(s: OpenCycle): TodayMood {
  if (s.events.some((e) => e.type === "overcommitted")) return "overcommitted";
  if (s.today.leftThisWeek < 0) return "overWeek";
  if (s.today.spendToday <= 0 && s.today.spentToday > 0) return "spentOut";
  if (s.today.spentToday === 0) return "fresh";
  return s.today.spendToday < s.today.dailyPace * 0.25 ? "tight" : "onTrack";
}

export function quipsFor(mood: TodayMood, tone: Tone): string[] {
  return QUIPS[mood][tone];
}

const REACTIONS: Record<string, Record<Tone, string>> = {
  food: {
    gentle: "Logged. Enjoy your meal.",
    cheeky: "Logged. The food gods are pleased. 🍜",
    unhinged: "LOGGED. THE NOODLE COUNCIL APPROVES 🍜🙏",
  },
  groceries: {
    gentle: "Logged. A stocked kitchen is a calm kitchen.",
    cheeky: "Logged. Fridge: restocked. Adulting: achieved. 🛒",
    unhinged: "LOGGED. YOU HUNTED. YOU GATHERED. 🛒🦣",
  },
  transport: {
    gentle: "Logged. Safe travels.",
    cheeky: "Logged. Places were gone to. 🚌",
    unhinged: "LOGGED. VROOM VROOM, MONEY GO ZOOM 🚌💨",
  },
  shopping: {
    gentle: "Logged. Hope it brings you joy.",
    cheeky: "Logged. Your cart and your conscience are square. 🛍️",
    unhinged: "LOGGED. RETAIL THERAPY SESSION BILLED 🛍️🛋️",
  },
  fun: {
    gentle: "Logged. Fun matters too.",
    cheeky: "Logged. Joy is a valid line item. 🎉",
    unhinged: "LOGGED. SEROTONIN PURCHASED 🎉🎉🎉",
  },
  health: {
    gentle: "Logged. Looking after yourself is worth it.",
    cheeky: "Logged. Investing in the only body you've got. ❤️",
    unhinged: "LOGGED. SELF-CARE ARC UNLOCKED ❤️‍🔥",
  },
  home: {
    gentle: "Logged. Home sweet home.",
    cheeky: "Logged. Nest: slightly fancier. 🏠",
    unhinged: "LOGGED. THE NEST GROWS STRONGER 🏠🪺",
  },
  other: {
    gentle: "Logged. All noted.",
    cheeky: "Logged. Mysterious, but noted. ✨",
    unhinged: "LOGGED. WE WILL NOT ASK QUESTIONS ✨🤫",
  },
};

const OVER_REACTIONS: Record<Tone, string> = {
  gentle: "Logged. That's past today's share, and the week will absorb it.",
  cheeky: "Logged. Today's budget just waved goodbye 👋 The week's got you.",
  unhinged: "LOGGED. TODAY'S BUDGET HAS BEEN OBLITERATED 💥 the week is coping",
};

export function reactionFor(category: string, tone: Tone, overToday: boolean): string {
  if (overToday) return OVER_REACTIONS[tone];
  return (REACTIONS[category] ?? REACTIONS.other!)[tone];
}

export type PaceStatus = "onTrack" | "slowDown" | "over";

export function paceStatus(s: OpenCycle): PaceStatus {
  if (s.today.leftThisWeek < 0) return "over";
  return s.today.spendToday < 0 ? "slowDown" : "onTrack";
}

export const PACE_LABEL: Record<PaceStatus, string> = { onTrack: "On track", slowDown: "Slow down", over: "Over" };

const SWEPT_LINES: Record<Tone, string> = {
  gentle: "✅ Under budget. Nice week.",
  cheeky: "✅ Steady Eddie week",
  unhinged: "✅ ABSOLUTE UNIT OF A WEEK 💪🔥",
};

const SPREAD_LINES: Record<Tone, string> = {
  gentle: "Over, and spread across the next weeks",
  cheeky: "🌶️ Spicy week, smoothed out",
  unhinged: "🌶️ WEEK WENT FERAL. Future weeks covered it 🦎",
};

/** History's one-liner for a finished week. Borrowing from savings gets the calm voice at every level. */
export function weekLine(outcome: WeekOutcome | undefined, tone: Tone, formatted: (n: number) => string): string {
  if (!outcome) return "";
  if (outcome.kind === "swept") return SWEPT_LINES[tone];
  if (outcome.floorHit) return `🫣 Floor hit, borrowed ${formatted(outcome.borrowed)} from savings`;
  return SPREAD_LINES[tone];
}
