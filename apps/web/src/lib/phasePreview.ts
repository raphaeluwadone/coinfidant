import type { Phase } from "@coinfidant/engine";
import type { TodayData } from "./today";

const KEY = "cf.phase.preview";
const NEXT: Record<Phase, Phase | null> = { stabilise: "attack", attack: "build", build: null };

export function readPhasePreview(): Phase | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "stabilise" || v === "attack" || v === "build" ? v : null;
  } catch {
    return null;
  }
}

export function writePhasePreview(phase: Phase | null) {
  try {
    if (phase) localStorage.setItem(KEY, phase);
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the preview just won't stick.
  }
}

/** Dev only: shows Today as if the user were in the previewed phase. Discovery is skipped too, so the skin shows. */
export function applyPhasePreview(data: TodayData): TodayData {
  const phase = import.meta.env.DEV ? readPhasePreview() : null;
  if (!phase) return data;
  return {
    ...data,
    budget: { ...data.budget, discovery: false },
    discovery: null,
    phase: { phase, next: NEXT[phase], unlocksAround: data.phase?.unlocksAround ?? null, celebrate: null },
  };
}
