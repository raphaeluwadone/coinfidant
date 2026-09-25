import type { OpenCycle } from "./types";

export type Tone = "gentle" | "cheeky" | "unhinged";

export const TONES: { key: Tone; label: string; emoji: string }[] = [
  { key: "gentle", label: "Gentle", emoji: "😌" },
  { key: "cheeky", label: "Cheeky", emoji: "😏" },
  { key: "unhinged", label: "Unhinged", emoji: "🤪" },
];

/**
 * A pool per tone. `warm` pools only have Gentle lines on purpose: debt and savings drains are never joked about,
 * at any level (plan doc voice rules), so every tone falls back to the calm voice.
 */
type Pool = { gentle: string[]; cheeky?: string[]; unhinged?: string[]; warm?: true };

const all = (gentle: string[], cheeky: string[], unhinged: string[]): Pool => ({ gentle, cheeky, unhinged });
const warm = (...gentle: string[]): Pool => ({ gentle, warm: true });

export const VOICE = {
  // Today hero quips
  "today.fresh": all(
    ["A clean slate today.", "Nothing spent yet. Nice and calm."],
    ["Your wallet is doing yoga 🧘", "Untouched. Suspiciously disciplined.", "Zero spent. Who even are you?"],
    ["WALLET IN MINT CONDITION 🧘✨", "Not a single naira moved. Legendary behaviour 🗿🔥"],
  ),
  "today.onTrack": all(
    ["You're right on pace.", "Steady does it."],
    ["Right on pace. Smooth operator 😎", "Spending like someone with a plan.", "Budget's comfy. Keep it that way."],
    ["PACE: IMMACULATE 😎📈", "The budget and you? Besties. Matching bracelets 💅"],
  ),
  "today.tight": all(
    ["A little tight today, and that's okay.", "Going easy for the rest of the day helps."],
    ["Getting cosy in here. Maybe skip the extra snack 👀", "Tight, not tragic."],
    ["WE ARE IN THE DANGER ZONE 🚨 (it's fine, mostly)", "Wallet is sweating. Put the snack DOWN 👀🥵"],
  ),
  "today.spentOut": all(
    ["Today's share is used up. Tomorrow resets.", "That's today done. You've got this."],
    ["Today's budget has left the chat 👋", "That's a wrap for today's money."],
    ["TODAY'S MONEY HAS LEFT THE BUILDING 🏃💨", "Budget: gone. Vibes: surviving 🫠"],
  ),
  "today.overWeek": all(
    ["This week ran over. We'll spread it gently across the next ones.", "A heavier week. The plan adjusts."],
    ["This week got a bit spicy 🌶️ We'll smooth it out.", "Over for the week. Future weeks are chipping in."],
    ["THIS WEEK WENT FERAL 🌶️🔥 future weeks are sending help", "We overspent. We're not proud. We're adapting 🦎"],
  ),
  "today.overcommitted": warm("Bills and savings are more than your pay. Let's adjust the plan together."),

  // Quick log reactions
  "log.food": all(
    ["Logged. Enjoy your meal."],
    ["Logged. The food gods are pleased. 🍜"],
    ["LOGGED. THE NOODLE COUNCIL APPROVES 🍜🙏"],
  ),
  "log.groceries": all(
    ["Logged. A stocked kitchen is a calm kitchen."],
    ["Logged. Fridge: restocked. Adulting: achieved. 🛒"],
    ["LOGGED. YOU HUNTED. YOU GATHERED. 🛒🦣"],
  ),
  "log.transport": all(
    ["Logged. Safe travels."],
    ["Logged. Places were gone to. 🚌"],
    ["LOGGED. VROOM VROOM, MONEY GO ZOOM 🚌💨"],
  ),
  "log.shopping": all(
    ["Logged. Hope it brings you joy."],
    ["Logged. Your cart and your conscience are square. 🛍️"],
    ["LOGGED. RETAIL THERAPY SESSION BILLED 🛍️🛋️"],
  ),
  "log.fun": all(
    ["Logged. Fun matters too."],
    ["Logged. Joy is a valid line item. 🎉"],
    ["LOGGED. SEROTONIN PURCHASED 🎉🎉🎉"],
  ),
  "log.health": all(
    ["Logged. Looking after yourself is worth it."],
    ["Logged. Investing in the only body you've got. ❤️"],
    ["LOGGED. SELF-CARE ARC UNLOCKED ❤️‍🔥"],
  ),
  "log.home": all(
    ["Logged. Home sweet home."],
    ["Logged. Nest: slightly fancier. 🏠"],
    ["LOGGED. THE NEST GROWS STRONGER 🏠🪺"],
  ),
  "log.other": all(
    ["Logged. All noted."],
    ["Logged. Mysterious, but noted. ✨"],
    ["LOGGED. WE WILL NOT ASK QUESTIONS ✨🤫"],
  ),
  "log.overToday": all(
    ["Logged. That's past today's share, and the week will absorb it."],
    ["Logged. Today's budget just waved goodbye 👋 The week's got you."],
    ["LOGGED. TODAY'S BUDGET HAS BEEN OBLITERATED 💥 the week is coping"],
  ),

  // Week outcomes (History) and sweeps
  "week.swept": all(["✅ Under budget. Nice week."], ["✅ Steady Eddie week"], ["✅ ABSOLUTE UNIT OF A WEEK 💪🔥"]),
  "week.spread": all(
    ["Over, and spread across the next weeks"],
    ["🌶️ Spicy week, smoothed out"],
    ["🌶️ WEEK WENT FERAL. Future weeks covered it 🦎"],
  ),
  "week.floorHit": warm("🫣 Floor hit, borrowed {amount} from savings"),
  "sweep.savings": all(
    ["Nice week! {amount} moved to savings 🌱"],
    ["{amount} swept into savings. Future you just did a little dance 💃"],
    ["{amount} YEETED into savings 🚀 Your bank account is blushing 😳"],
  ),
  // Paying debt down is progress, and progress can be celebrated. The debt itself is never the joke.
  "sweep.debt": all(
    ["{amount} went towards {name}."],
    ["{amount} straight onto {name}. That's progress 💪"],
    ["{amount} LAUNCHED AT {name} ⚔️ Progress unlocked!"],
  ),
  "event.borrowed": warm("{amount} came from savings to cover a heavy week. We'll steady things from here."),
  "event.salaryOverdue": warm("Your salary is {days} days past payday. Has it landed?"),

  // Payday mode
  "payday.lead": all(
    ["Let's set aside the essentials first."],
    ["Before we get excited, let's feed the responsibilities first 🍽️"],
    ["HOLD THE CELEBRATION 🛑 Responsibilities eat first 🍽️"],
  ),
  "payday.reveal": all(
    ["Everything's covered. Here's what's yours."],
    ["Responsibilities fed. This is yours."],
    ["RESPONSIBILITIES: FED 🍽️ THIS MONEY: YOURS 🎉"],
  ),
  "payday.sample": all(
    ["Salary landed. Let's cover the essentials first."],
    ["Salary landed! Before we get excited, let's feed the responsibilities first 🍽️"],
    ["SALARY LANDED 💸 Responsibilities eat first, then we party 🍽️🎉"],
  ),

  // Discovery cycle
  "discovery.intro": all(
    ["We'll learn your real numbers together this month. Just log things as they happen."],
    ["No stress. We'll figure out your real numbers together this month. Just log everything as it happens."],
    ["DETECTIVE MONTH 🔍 Log everything, we'll crack the case together 🕵️"],
  ),
  "discovery.done": all(
    ["Your plan runs on real numbers now."],
    ["Your plan runs on real numbers now. No more guessing."],
    ["CASE CLOSED 🔍 Your plan runs on REAL numbers now ✨"],
  ),

  // Onboarding reactions
  "onboarding.payday": all(
    ["Got it. We'll plan around your payday."],
    ["Noted. We'll be ready when it drops 🫡"],
    ["PAYDAY LOCKED IN. WE RIDE AT DAWN 🫡🐎"],
  ),
  "onboarding.bills.none": all(
    ["No fixed bills. That keeps things simple."],
    ["No bills? Living the dream ☁️"],
    ["ZERO BILLS?? Teach me your ways 🧘✨"],
  ),
  "onboarding.bills.low": all(
    ["{percent} of your pay goes to bills. That's a healthy share."],
    ["{percent} on bills? Respectable. Very adult of you 👔"],
    ["{percent} on bills?? Look at you being a FUNCTIONING ADULT 👔🔥"],
  ),
  "onboarding.bills.mid": all(
    ["{percent} of your pay goes to bills. We'll plan around it."],
    ["{percent} on bills. Chunky, but we can work with it 💪"],
    ["{percent} ON BILLS. The bills are eating well. We'll manage 🍽️"],
  ),
  "onboarding.bills.heavy": warm(
    "{percent} of your pay goes to bills. That's a lot, and we'll build the plan around what's left.",
  ),
  "onboarding.sinking.some": all(
    ["Set-asides make big bills feel small."],
    ["Future you won't be ambushed by these 🪣"],
    ["BIG BILLS, MEET YOUR SLOW-COOKER 🪣🔥"],
  ),
  "onboarding.sinking.none": all(
    ["Nothing big on the horizon. You can add some any time."],
    ["Nothing big coming? Enjoy the calm ☕"],
    ["NO BIG BILLS. Suspicious. But we love it ☕"],
  ),
  "onboarding.debts.none": warm("No debts. That gives us a lot of room to build 🌱"),
  "onboarding.debts.some": warm("Thanks for being honest. This is how we beat them 💪"),
  "onboarding.debts.many": warm("That's a lot to carry. We'll take them on one at a time, together."),
  "onboarding.goals.some": all(
    ["Lovely. We'll keep these in view."],
    ["Now we've got something to aim at 🎯"],
    ["MAIN CHARACTER GOALS DETECTED 🎯✨"],
  ),
  "onboarding.goals.none": all(
    ["That's fine. Goals can come later."],
    ["No goals yet? We'll find you some 😏"],
    ["NO GOALS YET. The plot is still loading 🎬"],
  ),
  "onboarding.everyday.discovery": all(
    ["No problem. We'll learn it together this month."],
    ["No stress. We'll figure it out together this month 🔍"],
    ["DETECTIVE MODE ON. We find out this month 🔍🕵️"],
  ),
  "onboarding.everyday.estimate": all(
    ["Thanks. We'll check it against real spending."],
    ["Got it. We'll see how close that guess is 👀"],
    ["NOTED. We will be FACT-CHECKING this 👀📋"],
  ),

  // Auto-tags
  "tag.run": all(["{nth} {noun} this week"], ["{nth} {noun} this week"], ["{nth} {noun} THIS WEEK 👀"]),
  "tag.round": all(["A nice round number"], ["Suspiciously round number"], ["SUSPICIOUSLY ROUND NUMBER 🧐"]),
  "tag.late": all(["A late-evening spend"], ["Late-night decision"], ["MIDNIGHT ENERGY 🌙"]),
  "tag.big": all(["A bigger spend"], ["Big spend energy"], ["BIG SPEND ENERGY 💸"]),
  "tag.friday": all(["A Friday treat"], ["Friday energy"], ["FRIDAY FEVER 🕺"]),
  "tag.weekend": all(["A weekend spend"], ["Weekend mode"], ["WEEKEND MODE ACTIVATED 🎉"]),
  "tag.flavour.food": all(["A meal"], ["Fuel for the soul"], ["FUEL FOR THE SOUL 🍜"]),
  "tag.flavour.groceries": all(["A grocery run"], ["Big shop energy"], ["BIG SHOP ENERGY 🛒"]),
  "tag.flavour.transport": all(["Getting around"], ["Getting places"], ["ZOOM ZOOM 🚌"]),
  "tag.flavour.shopping": all(["Something new"], ["Retail therapy"], ["RETAIL THERAPY 🛍️"]),
  "tag.flavour.fun": all(["Something fun"], ["Joy budget in action"], ["JOY BUDGET GO BRRR 🎉"]),
  "tag.flavour.health": all(["Looking after yourself"], ["Investing in you"], ["SELF-CARE ARC 💖"]),
  "tag.flavour.home": all(["For the home"], ["Nest upgrades"], ["NEST UPGRADE 🏠"]),
  "tag.flavour.other": all(["Something else"], ["Keeping it mysterious"], ["MYSTERY PURCHASE ✨"]),

  // Insights (R27)
  "insight.ahead": all(
    ["You're {amount} under pace this week."],
    ["{amount} under pace this week. Suspiciously responsible 😎"],
    ["{amount} UNDER PACE. Who ARE you 😎🔥"],
  ),
  "insight.behind": all(
    ["You're {amount} ahead of this week's pace. Easing off helps."],
    ["{amount} past pace this week. Pump the brakes a little 🛑"],
    ["{amount} OVER PACE. BRAKES. NOW 🛑😬"],
  ),
  "insight.swept": all(
    ["Last week you swept {amount}."],
    ["Last week swept {amount}. Tidy 🧹"],
    ["LAST WEEK SWEPT {amount} 🧹✨ CLEAN"],
  ),
  "insight.spread": all(
    ["Last week's extra {amount} is spread over the weeks ahead."],
    ["Last week's extra {amount} is being smoothed out 🌶️"],
    ["Last week's {amount} chaos is being SPREAD THIN 🌶️🧈"],
  ),
  "insight.borrowed": warm("Last week borrowed {amount} from savings. A steadier week helps it recover."),
  "insight.category": all(
    ["{emoji} {name} is {percent} of this week's spending."],
    ["{emoji} {name} is eating {percent} of this week's spending"],
    ["{emoji} {name} ATE {percent} OF THIS WEEK 🍽️"],
  ),
  "insight.weekday": all(
    ["{day}s tend to be your bigger spending days."],
    ["{day}s are your big spend days. Plan accordingly 📅"],
    ["{day}s ARE YOUR SPEND DAYS. WE SEE YOU 👀"],
  ),
  "insight.streak": all(
    ["{count} days of logging in a row."],
    ["{count}-day logging streak 🔥 Keep it going"],
    ["{count} DAY STREAK 🔥🔥 DON'T YOU DARE STOP"],
  ),
  "insight.gap": all(
    ["No logs for {days} days. Anything to catch up on?"],
    ["{days} days, no logs. Did your wallet go on holiday? 🏝️"],
    ["{days} DAYS OF SILENCE 🦗 Log something!!"],
  ),
  "insight.payday": all(
    ["Payday is {days} days away."],
    ["Payday in {days} days. Almost there 💸"],
    ["PAYDAY IN {days} DAYS 💸💸 HOLD THE LINE"],
  ),
  "insight.target": all(
    ["{amount} left on {name}."],
    ["{amount} to go on {name}. Keep swinging 💪"],
    ["{name}: {amount} HP LEFT ⚔️ FINISH IT"],
  ),

  // Phases (M7)
  "phase.stabilise": all(
    ["Minimums covered, lights on. Steady progress."],
    ["Minimums paid, rent fund fed, lights still on. Honestly? Iconic 😏"],
    ["MINIMUMS: PAID 🛟 LIGHTS: ON 💡 VIBES: IMMACULATE"],
  ),
  "phase.attack": all(
    ["{amount} extra is going to your debts this cycle."],
    ["Extra {amount} this cycle is already loaded into the cannon 🎯"],
    ["{amount} LOADED INTO THE CANNON 🎯💥 FIRE AT WILL"],
  ),
  "phase.build": all(
    ["No debts. Everything now builds your future."],
    ["Zero debts. Who even ARE you? 🌱✨"],
    ["ZERO DEBTS 🌱🌱 THE FUTURE IS LOOKING THICK"],
  ),
  "phaseup.attack": all(
    ["Every minimum is on time and the essentials are covered. Now extra money goes to the most expensive debt first."],
    ["Every minimum's on time, the rent fund's fed. Time to hunt debts, most expensive first 🎯"],
    ["MINIMUMS HANDLED 🛟 NOW WE HUNT ⚔️ Most expensive debt goes first 🎯"],
  ),
  "phaseup.build": all(
    ["Every debt is cleared. From here, your money builds your goals."],
    ["Every debt: defeated 💀 From here on, money grows the future 🌱"],
    ["ALL DEBTS DEFEATED 💀💀 WELCOME TO THE GROWTH ERA 🌱🚀"],
  ),
  "sweep.offer": all(
    ["Put it towards {name}, or keep it in savings? Your call."],
    ["Throw it at {name}? Or tuck it into savings? Your call."],
    ["ATTACK {name} ⚔️ or HOARD IT 🌱? Choose wisely"],
  ),

  // Push check-ins (M9)
  "checkin.evening": all(
    ["Evening. Anything to log today? You have {amount} for tomorrow."],
    [
      "Evening 🌙 Anything to log? {amount} is ready for tomorrow.",
      "Quick one: anything to log? {amount} waiting for tomorrow.",
    ],
    ["EVENING CHECK 🌙📋 Log it before it escapes. {amount} LOCKED IN for tomorrow 🔒"],
  ),
  "checkin.drift": all(
    ["This week is {amount} over plan. A quiet day tomorrow brings it back."],
    ["This week has drifted {amount} over 👀 A chill day tomorrow fixes a lot."],
    ["WEEK IS {amount} OVER 🚨 TOMORROW WE GO FULL MONK MODE 🧘"],
  ),

  // Growth
  "badge.unlocked": all(
    ["New badge: {badge} {name}"],
    ["{badge} {name} unlocked. Look at you."],
    ["{badge} {name} UNLOCKED 🏆 LEGEND BEHAVIOUR"],
  ),
  "streak.line": all(
    ["Logged something {count} days in a row"],
    ["Logged something every day for {count} days"],
    ["{count} DAYS STRAIGHT. UNSTOPPABLE 🔥"],
  ),
} satisfies Record<string, Pool>;

export type VoiceKey = keyof typeof VOICE;

const FALLBACK: Record<Tone, Tone[]> = {
  gentle: ["gentle"],
  cheeky: ["cheeky", "gentle"],
  unhinged: ["unhinged", "cheeky", "gentle"],
};

/**
 * The lines for a moment in a tone, falling back one level toward Gentle when a tone has none.
 * `stakes` is the override: when savings keep getting drained, every level gets the warm, clear voice.
 */
export function linesFor(key: VoiceKey, tone: Tone, opts: { stakes?: boolean } = {}): string[] {
  const pool: Pool = VOICE[key];
  for (const t of opts.stakes ? FALLBACK.gentle : FALLBACK[tone]) {
    const lines = pool[t];
    if (lines?.length) return lines;
  }
  return pool.gentle;
}

const fill = (line: string, vars: Record<string, string | number>) =>
  line.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

/**
 * One line for a moment. `seed` picks the rotation position (a day number keeps a line steady for the day);
 * `avoid` skips lines shown recently so the same joke doesn't repeat back to back.
 */
export function say(
  key: VoiceKey,
  tone: Tone,
  vars: Record<string, string | number> = {},
  opts: { stakes?: boolean; seed?: number; avoid?: string[] } = {},
): string {
  const lines = linesFor(key, tone, opts);
  const fresh = lines.filter((l) => !opts.avoid?.includes(fill(l, vars)));
  const pick = (fresh.length ? fresh : lines)[Math.abs(opts.seed ?? 0) % (fresh.length || lines.length)]!;
  return fill(pick, vars);
}

/** Stakes override: savings borrowed in two or more weeks, or a plan that doesn't fit the pay. */
export function stakesHigh(open: Pick<OpenCycle, "events">, opts: { borrowedLastCycle?: boolean } = {}): boolean {
  const borrowedWeeks = open.events.filter((e) => e.type === "borrowedFromSavings").length;
  const overcommitted = open.events.some((e) => e.type === "overcommitted");
  return overcommitted || borrowedWeeks >= 2 || (borrowedWeeks >= 1 && !!opts.borrowedLastCycle);
}
