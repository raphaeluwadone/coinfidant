import type { Phase, Tone } from "@coinfidant/engine";

/** Today's interface copy, per tone. Numbers are passed in pre-formatted and never carry emoji. */
type Lines = Record<Tone, string>;
const t = (gentle: string, cheeky: string, unhinged: string): Lines => ({ gentle, cheeky, unhinged });

export const TODAY_COPY = {
  subtitle: {
    stabilise: t(
      "Covering the essentials first.",
      "Stopping the bleeding. Bandages are on the house. 🩹",
      "TRIAGE MODE 🚑 WE ARE STOPPING THE BLEEDING",
    ),
    attack: t(
      "Bills are covered. Now the debts.",
      "Bills are fed. Now we go hunting. ⚔️",
      "BILLS: FED 🍽️ DEBTS: HUNTED 🏹 VIBES: LETHAL",
    ),
    build: t(
      "Debt-free. Now it's all yours to grow.",
      "Debt-free and dangerous. Let's grow something. 🌱",
      "DEBT-FREE 🌱 FUTURE: LOADING 🚀 LET'S GOOO",
    ),
    discovery: t(
      "This month we're learning your pattern.",
      "Learning month. Log it all, judge nothing. 🔍",
      "DETECTIVE MODE 🔍 EVERY NAIRA IS A CLUE",
    ),
  } satisfies Record<Phase | "discovery", Lines>,
  hero: {
    stabilise: { label: "Safe to spend today", sticker: t("yours", "all yours", "ALL YOURS") },
    attack: { label: "Extra firepower this month", sticker: t("extra", "ammo", "AMMO 💥") },
    build: { label: "Savings rate this cycle", sticker: t("growing", "future you says hi", "FUTURE YOU SAYS HI") },
    discovery: { label: "Safe to spend today", sticker: t("learning", "learning you", "LEARNING YOU 👀") },
  },
  rollover: t(
    "Includes {amount} carried over from earlier this week",
    "Includes {amount} you heroically didn't spend earlier",
    "Includes {amount} you DIDN'T spend earlier. HERO BEHAVIOUR",
  ),
  rolloverDown: t(
    "{amount} less than a usual day, after earlier this week",
    "{amount} lighter than usual. Earlier this week had plans",
    "{amount} LIGHTER. EARLIER-THIS-WEEK YOU WAS BUSY",
  ),
  freed: t(
    "Includes {amount} freed from a debt you cleared.",
    "Includes {amount} freed from your last defeated debt.",
    "Includes {amount} looted from a FALLEN BOSS 💀",
  ),
  noFirepower: t(
    "Anything past the minimums goes to your debts. Sweep a week's leftovers to add some.",
    "Nothing extra loaded yet. Sweep a week's leftovers at your target to arm up.",
    "AMMO: ZERO. SWEEP SOME LEFTOVERS AT THE TARGET 🎯",
  ),
  safeToSpend: "Safe to spend today: {amount}",
  rateUp: "Up from {rate} last cycle.",
  rateDown: "Down from {rate} last cycle.",
  rateSame: "Same as last cycle.",
  glowUp: {
    stabilise: t("Attack unlocks around {month}", "Boss fights start ~{month}", "BOSS FIGHTS ~{month} ⚔️"),
    attack: t("Build unlocks around {month}", "Build unlocks ~{month} 🌱", "BUILD ~{month} 🌱 ALMOST THERE"),
    build: t("All three phases done", "Final boss: your future self 😎", "FINAL BOSS: FUTURE YOU 😎"),
    unknown: t("Next phase coming", "Next phase loading", "NEXT PHASE LOADING ⏳"),
  },
  weekOver: t("{day} ran over", "{day} happened 😬", "{day} WENT FERAL 🔥"),
  youAreHere: t("today", "you are here", "YOU ARE HERE"),
  checklist: {
    title: t("This cycle's commitments", "Adulting checklist", "ADULTING CHECKLIST"),
    sub: t(
      "Commitments first, then the rest.",
      "Responsibilities first. Then the fun. 🫡",
      "RESPONSIBILITIES FIRST. FUN LATER 🫡",
    ),
  },
  safetyNets: {
    title: t("Big bills", "Safety nets", "SAFETY NETS"),
    sub: t(
      "Big bills, set aside month by month.",
      "Big bills, pre-chewed into monthly bites.",
      "BIG BILLS, CHOPPED INTO BITES 🔪",
    ),
  },
  target: {
    sticker: t("Current target", "Current target", "CURRENT TARGET"),
    sub: t("Highest cost first.", "Most expensive first. No mercy.", "MOST EXPENSIVE FIRST. NO MERCY 😤"),
  },
  hitList: {
    title: t("Next up", "The hit list", "THE HIT LIST"),
    sub: t(
      "Cleared debts pass their payment on.",
      "Fallen bosses pass their power down.",
      "FALLEN BOSSES PASS THEIR POWER DOWN 💀",
    ),
    rolled: "Its {amount} payment rolled into {name}",
  },
  goals: {
    title: t("Goals", "Goals", "GOALS"),
    sub: t("Where your savings are heading.", "Your future, in progress bars.", "YOUR FUTURE, IN PROGRESS BARS 📊"),
    halfway: t("halfway", "Halfway hero", "HALFWAY HERO"),
  },
  people: {
    title: t("People you support", "Your people", "YOUR PEOPLE"),
    sub: t(
      "Minimums covered, ideals when there's room.",
      "Minimums sorted. Ideals when we can flex.",
      "MINIMUMS SORTED. IDEALS WHEN WE FLEX 💪",
    ),
  },
  recent: {
    title: t("Recent spends", "Recent spends", "RECENT CRIMES"),
    more: t("See all transactions", "See the receipts", "SEE THE RECEIPTS 🧾"),
  },
  week: { title: t("This week", "The week so far", "THE WEEK SO FAR") },
} as const;

export const fill = (line: string, vars: Record<string, string>) =>
  line.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);

export function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
}
