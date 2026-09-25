export const CREDITORS = [
  { label: "Loan app", emoji: "📱" },
  { label: "Bank", emoji: "🏦" },
  { label: "Family & friends", emoji: "👪" },
  { label: "Card", emoji: "💳" },
  { label: "Other", emoji: "🤝" },
] as const;

export const creditorEmoji = (creditor: string) => CREDITORS.find((c) => c.label === creditor)?.emoji ?? "🤝";

const BILL_EMOJI: [RegExp, string][] = [
  [/light|electric|nepa|power|phcn/i, "💡"],
  [/data|internet|wifi|airtime/i, "📶"],
  [/spotify|netflix|music|showmax|dstv|gotv|tv/i, "🎧"],
  [/clean|house ?help|laundry/i, "🧹"],
  [/water/i, "💧"],
  [/fuel|petrol|diesel|gen/i, "⛽"],
  [/gym|fitness/i, "🏋️"],
  [/rent|house/i, "🏠"],
  [/school|fees|tuition/i, "🎓"],
  [/phone|mobile/i, "📱"],
];
export const billEmoji = (name: string) => BILL_EMOJI.find(([re]) => re.test(name))?.[1] ?? "🧾";
