export const CATEGORIES = [
  { key: "food", label: "Food", emoji: "🍜" },
  { key: "groceries", label: "Groceries", emoji: "🛒" },
  { key: "transport", label: "Transport", emoji: "🚌" },
  { key: "shopping", label: "Shopping", emoji: "🛍️" },
  { key: "fun", label: "Fun", emoji: "🎉" },
  { key: "health", label: "Health", emoji: "❤️" },
  { key: "home", label: "Home", emoji: "🏠" },
  { key: "other", label: "Other", emoji: "✨" },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key) as [CategoryKey, ...CategoryKey[]];

export const categoryOf = (key: string) => CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[CATEGORIES.length - 1]!;
