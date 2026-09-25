import type { Tone } from "./copy";
import { formatMoney } from "./money";

type Lines = Record<Tone, string>;

/** The sweep line from the plan doc, used to preview each sass level on the welcome step. */
export const sweepPreview = (amount: number): Lines => ({
  gentle: `Nice week! ${formatMoney(amount)} moved to savings 🌱`,
  cheeky: `${formatMoney(amount)} swept into savings. Future you just did a little dance 💃`,
  unhinged: `${formatMoney(amount)} YEETED into savings 🚀 Your bank account is blushing 😳`,
});

export const paydayLine: Lines = {
  gentle: "Got it. We'll plan around your payday.",
  cheeky: "Noted. We'll be ready when it drops 🫡",
  unhinged: "PAYDAY LOCKED IN. WE RIDE AT DAWN 🫡🐎",
};

export function billsLine(percent: number, tone: Tone): string {
  if (percent === 0) {
    return {
      gentle: "No fixed bills. That keeps things simple.",
      cheeky: "No bills? Living the dream ☁️",
      unhinged: "ZERO BILLS?? Teach me your ways 🧘✨",
    }[tone];
  }
  const p = `${Math.round(percent)}%`;
  if (percent < 25) {
    return {
      gentle: `${p} of your pay goes to bills. That's a healthy share.`,
      cheeky: `${p} on bills? Respectable. Very adult of you 👔`,
      unhinged: `${p} on bills?? Look at you being a FUNCTIONING ADULT 👔🔥`,
    }[tone];
  }
  if (percent < 50) {
    return {
      gentle: `${p} of your pay goes to bills. We'll plan around it.`,
      cheeky: `${p} on bills. Chunky, but we can work with it 💪`,
      unhinged: `${p} ON BILLS. The bills are eating well. We'll manage 🍽️`,
    }[tone];
  }
  // Stakes override: a heavy bill load gets the calm voice at every level.
  return `${p} of your pay goes to bills. That's a lot, and we'll build the plan around what's left.`;
}

export const sinkingLine = (count: number): Lines =>
  count
    ? {
        gentle: "Set-asides make big bills feel small.",
        cheeky: "Future you won't be ambushed by these 🪣",
        unhinged: "BIG BILLS, MEET YOUR SLOW-COOKER 🪣🔥",
      }
    : {
        gentle: "Nothing big on the horizon. You can add some any time.",
        cheeky: "Nothing big coming? Enjoy the calm ☕",
        unhinged: "NO BIG BILLS. Suspicious. But we love it ☕",
      };

/** Debt is never joked about (plan doc voice rules), so every level gets a warm line. */
export function debtsLine(count: number): string {
  if (count === 0) return "No debts. That gives us a lot of room to build 🌱";
  if (count >= 5) return "That's a lot to carry. We'll take them on one at a time, together.";
  return "Thanks for being honest. This is how we beat them 💪";
}

export const goalsLine = (count: number): Lines =>
  count
    ? {
        gentle: "Lovely. We'll keep these in view.",
        cheeky: "Now we've got something to aim at 🎯",
        unhinged: "MAIN CHARACTER GOALS DETECTED 🎯✨",
      }
    : {
        gentle: "That's fine. Goals can come later.",
        cheeky: "No goals yet? We'll find you some 😏",
        unhinged: "NO GOALS YET. The plot is still loading 🎬",
      };

export const everydayLine = (discovery: boolean): Lines =>
  discovery
    ? {
        gentle: "No problem. We'll learn it together this month.",
        cheeky: "No stress. We'll figure it out together this month 🔍",
        unhinged: "DETECTIVE MODE ON. We find out this month 🔍🕵️",
      }
    : {
        gentle: "Thanks. We'll check it against real spending.",
        cheeky: "Got it. We'll see how close that guess is 👀",
        unhinged: "NOTED. We will be FACT-CHECKING this 👀📋",
      };

export const paydayModeSample = "Salary landed! Before we get excited, let's feed the responsibilities first 🍽️";

export const REVEAL_TAGLINE = "It's not a mess. It's a plan now 😏";
