import type { WeekStart } from "./calendar";
import type { ISODate } from "./date";
import type { Minor } from "./money";

export type Debt = {
  id: string;
  name: string;
  creditor: string;
  amountLeft: Minor;
  hasInterest: boolean;
  plan:
    | { kind: "oneOff"; due: ISODate }
    | { kind: "installments"; perCycle: Minor }
    | { kind: "flexible"; min: Minor; ideal: Minor };
};

export type SweepChoice = { to: "savings" } | { to: "debt"; debtId: string };

export type EngineInput = {
  today: ISODate;
  settings: {
    savingsPercent: number;
    minSavingsPercent: number;
    floorPercent: number;
    weekStart: WeekStart;
    expectedPayday: number;
    everydayEstimate: Minor | null;
    /** R21: where a week's leftover goes when nobody picked. */
    leftoverDefault: "savings" | "debts";
  };
  cycle: { start: ISODate; salary: Minor };
  bills: { id: string; name: string; amount: Minor }[];
  sinkingFunds: { id: string; name: string; target: Minor; saved: Minor; due: ISODate }[];
  debts: Debt[];
  commitments: { id: string; name: string; min: Minor; ideal: Minor }[];
  transactions: { id: string; amount: Minor; date: ISODate; type: "spend" | "refund" }[];
  sweepChoices: Record<number, SweepChoice>;
  debtPayments: { debtId: string; amount: Minor }[];
  /** R24: top-ups toward a commitment's or flexible debt's ideal, accepted for this cycle. */
  topUps?: { id: string; amount: Minor }[];
};

export type WeekOutcome =
  | { kind: "swept"; amount: Minor; to: "savings" | { debtId: string } }
  | { kind: "over"; amount: Minor; spread: Minor; borrowed: Minor; floorHit: boolean };

export type Week = {
  index: number;
  start: ISODate;
  end: ISODate;
  days: number;
  base: Minor;
  floor: Minor;
  budget: Minor;
  spent: Minor;
  status: "past" | "current" | "future";
  outcome?: WeekOutcome;
};

export type DayState = "on" | "covered" | "over" | "today" | "upcoming" | "outside";
export type DayCell = { date: ISODate; spent: Minor; state: DayState };

export type EngineEvent =
  | { type: "sweep"; week: number; amount: Minor; to: "savings" | string }
  | { type: "carryForward"; week: number; amount: Minor }
  | { type: "borrowedFromSavings"; week: number; amount: Minor }
  | { type: "overcommitted"; shortfall: Minor }
  | { type: "tight"; flexible: Minor }
  | { type: "debtSqueezesSavings"; amount: Minor }
  | { type: "salaryOverdue"; daysLate: number };

export type Suggestion = { kind: "idealTopUp"; id: string; amount: Minor } | { kind: "splitDebt"; debtId: string };

export type PlanBreakdown = {
  salary: Minor;
  bills: Minor;
  sinking: { id: string; setAside: Minor }[];
  commitments: { id: string; amount: Minor }[];
  debts: { id: string; due: Minor; fromSavings: Minor; fromFlexible: Minor }[];
  savingsGoal: Minor;
  savingsPlanned: Minor;
  flexible: Minor;
};

export type Savings = {
  planned: Minor;
  swept: Minor;
  sweptToDebts: { debtId: string; amount: Minor }[];
  borrowed: Minor;
  net: Minor;
};

export type OpenCycle = {
  cycle: { start: ISODate; projectedEnd: ISODate; days: number; dayIndex: number; overrunDays: number };
  plan: PlanBreakdown;
  weeks: Week[];
  today: {
    date: ISODate;
    week: Week;
    spendToday: Minor;
    spentToday: Minor;
    dailyPace: Minor;
    leftThisWeek: Minor;
    daysLeftInWeek: number;
    strip: DayCell[];
  };
  savings: Savings;
  suggestions: Suggestion[];
  events: EngineEvent[];
};

export type ClosedCycle = {
  engineVersion: string;
  cycle: { start: ISODate; end: ISODate; days: number };
  plan: PlanBreakdown;
  weeks: Week[];
  spent: Minor;
  savings: Savings;
  /** Net savings as basis points of salary (1234 = 12.34%). */
  savingsRateBp: number;
  debts: { id: string; amountLeft: Minor; unpaid: Minor }[];
  sinkingFunds: { id: string; saved: Minor }[];
  events: EngineEvent[];
};
