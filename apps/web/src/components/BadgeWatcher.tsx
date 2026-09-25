import { say } from "@coinfidant/engine";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { growthQuery } from "../lib/growth";
import { todayQuery } from "../lib/today";
import { useToast } from "./Toasts";

const SEEN_KEY = "cf.badges.seen";

const readSeen = (): string[] | null => {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
};
const writeSeen = (keys: string[]) => {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(keys));
  } catch {
    // Storage can be unavailable (private mode); the toast just won't be remembered.
  }
};

/** Toasts a badge the first time it shows up as earned. The first ever look records silently. */
export function BadgeWatcher() {
  const toast = useToast();
  const { data } = useQuery(growthQuery);
  const { data: today } = useQuery(todayQuery);

  useEffect(() => {
    if (!data || !today) return;
    const earned = data.badges.filter((b) => b.earned);
    const seen = readSeen();
    if (seen) {
      const tone = today.stakes ? "gentle" : today.prefs.personality;
      for (const b of earned.filter((x) => !seen.includes(x.key))) {
        toast({ text: say("badge.unlocked", tone, { badge: b.emoji, name: b.name }), tone: "accent" }, 4500);
      }
    }
    writeSeen(earned.map((b) => b.key));
  }, [data, today, toast]);

  return null;
}
