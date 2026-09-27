import type { Tone } from "@coinfidant/engine";

const t = (gentle: string, cheeky: string, unhinged: string): Record<Tone, string> => ({ gentle, cheeky, unhinged });

/** Transactions' interface copy, per tone. */
export const TXN_COPY = {
  title: t("Your spending", "Where the money went", "THE RECEIPTS 🧾"),
  sub: t(
    "Every naira, in one place.",
    "Every naira, accounted for. Even the suya.",
    "Every naira. Every crime. Every suya 🍢🚨",
  ),
  search: t("Search your spending", "Search the evidence", "search the crime scene 🔍"),
  breakdown: t("By category", "Where it went", "THE BREAKDOWN 🍩"),
  swings: t("Biggest spends", "The big swings", "THE DAMAGE REPORT 💥"),
  ouch: t("biggest", "ouch 😬", "YIKES 💀"),
  nothing: t(
    "Nothing matches that.",
    "Nothing matches. Suspiciously clean.",
    "NOTHING. THE CRIME SCENE IS SPOTLESS 🧽",
  ),
  empty: t(
    "Log something and it shows up here.",
    "Your account is suspiciously quiet 🦗 Log something and break the silence.",
    "SILENCE 🦗 LOG SOMETHING. ANYTHING.",
  ),
};
