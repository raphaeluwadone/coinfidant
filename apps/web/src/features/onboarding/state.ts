import type { DebtInput, OnboardingInput } from "@coinfidant/contracts";
import { cycleStartFor, type EngineInput, type ISODate, type Minor, type Tone } from "@coinfidant/engine";

export { billEmoji, CREDITORS, creditorEmoji } from "../../lib/emoji";

export type Answers = {
  personality: Tone;
  salary: Minor;
  expectedPayday: number;
  lastSalaryOn: ISODate | null;
  bills: { name: string; amount: Minor }[];
  sinkingFunds: { name: string; target: Minor; dueDate: ISODate }[];
  debts: DebtInput[];
  goals: { name: string; emoji: string; target: Minor }[];
  commitments: { name: string; min: Minor; ideal: Minor }[];
  everydayEstimate: Minor;
  discovery: boolean;
  leakCategories: OnboardingInput["leakCategories"];
  overspendTimes: OnboardingInput["overspendTimes"];
  checkinMethod: OnboardingInput["checkinMethod"];
  leftoverDefault: OnboardingInput["leftoverDefault"];
};

export const initialAnswers: Answers = {
  personality: "cheeky",
  salary: 0,
  expectedPayday: 31,
  lastSalaryOn: null,
  bills: [],
  sinkingFunds: [],
  debts: [],
  goals: [],
  commitments: [],
  everydayEstimate: 0,
  discovery: false,
  leakCategories: [],
  overspendTimes: [],
  checkinMethod: "evening",
  leftoverDefault: "savings",
};

export const salaryDate = (a: Answers, today: ISODate) => a.lastSalaryOn ?? cycleStartFor(today, a.expectedPayday);

export function toPayload(a: Answers, today: ISODate, timezone: string): OnboardingInput {
  return {
    personality: a.personality,
    timezone,
    salary: a.salary,
    expectedPayday: a.expectedPayday,
    lastSalaryOn: salaryDate(a, today),
    bills: a.bills,
    sinkingFunds: a.sinkingFunds,
    debts: a.debts,
    goals: a.goals,
    commitments: a.commitments,
    everydayEstimate: a.discovery ? null : a.everydayEstimate,
    discovery: a.discovery,
    leakCategories: a.leakCategories,
    overspendTimes: a.overspendTimes,
    checkinMethod: a.checkinMethod,
    leftoverDefault: a.leftoverDefault,
  };
}

/** The same input the API will build once saved, so the reveal shows the real numbers before anything is stored. */
export function previewInput(a: Answers, today: ISODate): EngineInput {
  return {
    today,
    settings: {
      savingsPercent: 10,
      minSavingsPercent: 5,
      floorPercent: 70,
      weekStart: 0,
      expectedPayday: a.expectedPayday,
      everydayEstimate: a.discovery ? null : a.everydayEstimate,
      leftoverDefault: a.leftoverDefault,
    },
    cycle: { start: salaryDate(a, today), salary: a.salary },
    bills: a.bills.map((b, i) => ({ id: `b${i}`, ...b })),
    sinkingFunds: a.sinkingFunds.map((f, i) => ({
      id: `f${i}`,
      name: f.name,
      target: f.target,
      saved: 0,
      due: f.dueDate,
    })),
    debts: a.debts.map((d, i) => ({
      id: `d${i}`,
      name: d.name,
      creditor: d.creditor,
      amountLeft: d.amountLeft,
      hasInterest: d.hasInterest ?? false,
      plan: d.plan,
    })),
    commitments: a.commitments.map((c, i) => ({ id: `c${i}`, ...c })),
    transactions: [],
    sweepChoices: {},
    debtPayments: [],
  };
}
