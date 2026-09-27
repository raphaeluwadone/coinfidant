export type ThemeChoice = "system" | "light" | "dark";

const KEY = "cf.theme";
const COLORS = { light: "#EEF1FA", dark: "#17161A" } as const;
const MEDIA = { light: "(prefers-color-scheme: light)", dark: "(prefers-color-scheme: dark)" } as const;

/** This device's choice; public/theme.js reads the same key before first paint. */
export function getTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function setTheme(choice: ThemeChoice) {
  try {
    if (choice === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // Storage blocked: the choice still applies until the page reloads.
  }
  const root = document.documentElement;
  if (choice === "system") delete root.dataset.theme;
  else root.dataset.theme = choice;
  // The browser bar colour follows too; "system" restores the per-scheme values from index.html.
  for (const scheme of ["light", "dark"] as const) {
    const meta = document.querySelector(`meta[name="theme-color"][media="${MEDIA[scheme]}"]`);
    meta?.setAttribute("content", choice === "system" ? COLORS[scheme] : COLORS[choice]);
  }
}
