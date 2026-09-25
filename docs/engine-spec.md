# Budget engine spec (M1)

`packages/engine` turns a budget's settings, commitments and transactions into every number the app shows. It is pure:
no I/O, no clock, no timezone lookups. Callers pass local calendar dates (`YYYY-MM-DD`) and integer minor units.

Source of truth for the rules: the plan doc, section "Money model". Rule IDs (R1, R2, ...) are referenced by tests.

## Inputs

```ts
type EngineInput = {
  today: ISODate; // the user's local date
  settings: {
    savingsPercent: number; // goal, % of salary received
    minSavingsPercent: number; // default 5; debt repayments can't push savings below this
    floorPercent: number; // default 70; a week's budget never drops below this % of its normal budget
    weekStart: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Monday (default)
    expectedPayday: number; // 1–31, clamped to month end
    everydayEstimate: Minor | null; // from onboarding; null = "No idea" (discovery cycle)
    leftoverDefault: "savings" | "debts"; // R21
  };
  cycle: { start: ISODate; salary: Minor }; // opened when salary is marked received
  bills: { id: string; name: string; amount: Minor }[]; // monthly, fixed
  sinkingFunds: { id: string; name: string; target: Minor; saved: Minor; due: ISODate }[];
  debts: Debt[];
  commitments: { id: string; name: string; min: Minor; ideal: Minor }[]; // e.g. support for a family member
  transactions: { id: string; amount: Minor; date: ISODate; type: "spend" | "refund" }[];
  sweepChoices: Record<number, { to: "savings" } | { to: "debt"; debtId: string }>; // by week index
  debtPayments: { debtId: string; amount: Minor }[]; // repayments marked paid this cycle
  topUps?: { id: string; amount: Minor }[]; // R24, accepted on payday
};

type Debt = {
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
```

Only transactions dated inside the open cycle count. Fixed bills are never transactions (plan doc, "Entry flow").

## Rules

### Cycle

- **R1 Cycle start.** The cycle starts on `cycle.start`, the day salary was marked received. It never starts from the
  calendar alone.
- **R2 Projected end.** The salary belongs to the expected payday nearest `cycle.start` (so pay landing on the 29th
  for the 30th still counts as the 30th's). The cycle is planned to end the day before the payday after that one.
  `expectedPayday` clamps to the month's last day (31 means 30 Sep, 28 or 29 Feb).
- **R3 Early salary.** If salary lands before the projected end, the caller closes this cycle and opens a new one. The
  engine only ever plans one open cycle.
- **R4 Late salary.** If `today` is past the projected end, the cycle is _overrunning_. Overrun days get no new money:
  the final week stretches to today, and what is left of it is paced through a grace window ending 2 days after the
  expected payday (then one day at a time). From 2 days past the expected payday the engine emits `salaryOverdue`,
  which the app turns into "Did your salary land?".

### Plan

- **R5 Debt due this cycle.**
  - `oneOff`: the full `amountLeft` if `due` falls inside the projected cycle, else 0.
  - `installments`: `min(perCycle, amountLeft)`.
  - `flexible`: `min(plan.min, amountLeft)`.
- **R6 Debt split.** Debt due comes out of the savings goal first, down to `minSavingsPercent` of salary. The rest
  comes out of flexible money.
  ```
  savingsGoal   = round(salary × savingsPercent / 100)
  savingsFloor  = round(salary × minSavingsPercent / 100)
  fromSavings   = min(debtDue, max(0, savingsGoal − savingsFloor))
  savingsPlanned = savingsGoal − fromSavings
  fromFlexible  = debtDue − fromSavings
  ```
  If the goal is already below the floor, savings stay at the goal and nothing comes from savings.
- **R7 Sinking funds.** Each fund sets aside `ceil((target − saved) / cyclesLeft)`, where `cyclesLeft` counts this
  cycle and every later payday up to `due`, minimum 1. A funded fund or a past due date sets aside 0.
- **R8 Commitments.** Minimum vs ideal commitments are budgeted at `min`.
- **R9 Flexible money.**
  ```
  flexible = salary − bills − sinkingSetAsides − commitmentMins − debtDue − savingsPlanned
  ```
  The full `debtDue` comes off: the part taken from savings is already missing from `savingsPlanned`, so only
  `fromFlexible` actually reduces flexible money.
  If it is negative, flexible is 0 and the engine emits `overcommitted` with the shortfall. If it is under 10% of
  salary, the engine emits `tight`. Both suggest splitting a `oneOff` debt into installments when one is due.
- **R10 Ideal top-ups.** When `everydayEstimate` is known and below flexible, the headroom `flexible − everydayEstimate`
  is offered toward each commitment's and flexible debt's ideal, in list order. These are suggestions only. They change
  no numbers until accepted.

### Weeks and days

- **R11 Weeks.** The cycle is split into calendar weeks starting on `weekStart`. The first and last weeks can be short.
- **R12 Weekly budget.** `floor(flexible × weekDays / cycleDays)` per week. The rounding remainder goes to the last
  week, so the weeks sum exactly to flexible.
- **R13 Daily allowance.** `floor(leftAtStartOfToday / daysLeftInWeekIncludingToday)`. Spending earlier in the week
  lowers it and unspent money raises it (rollover within the week). Today's own spending lowers "left today" one to one,
  not the allowance.
- **R14 Refunds.** A `refund` transaction subtracts from spending on its date. A day's net spend can't go below 0 for
  day-state colouring, but the week total keeps the credit.

### Week end

- **R15 Sweep.** A finished week's leftover is swept. The destination is `sweepChoices[week]`, defaulting to savings.
  A sweep to a debt reduces that debt's `amountLeft` in the close output. It doesn't change this cycle's plan.
- **R16 Carry-forward.** A finished week's overspend is spread across the remaining weeks in proportion to their normal
  budgets. No week drops below `floorPercent` of its normal budget. Room is refilled from weeks that still have it.
- **R17 Floor hit.** Whatever the floor can't absorb is borrowed from savings. The week gets `floorHit` and the engine
  emits `borrowedFromSavings` with the amount.
- **R18 Final week.** Overspend in the final week (or in overrun days) has no later week to absorb it, so it is borrowed
  from savings at close and flagged the same way.
- **R19 Back-dated entries.** The engine recomputes from all transactions every time. A back-dated spend can turn a
  past week's sweep into a carry-forward. Nothing is committed until the cycle closes.

### Leftovers and phases

- **R21 Leftover default.** A finished week with no `sweepChoices` entry sweeps to the current attack target (R22) when
  `leftoverDefault` is `debts`, otherwise to savings. With no active debts it always goes to savings.
- **R22 Attack order.** Active debts (amount left above 0), interest-bearing first, then the smallest balance
  (snowball), then by id. There's no interest rate yet, so `hasInterest` is the only cost signal.
- **R23 Phase.** No active debts is **Build**. Active debts plus a squeezed plan is **Stabilise**: `overcommitted`,
  `tight`, or any repayment taking money from flexible (`fromFlexible > 0`). Anything else is **Attack**. The rough
  unlock month is `cycle.start` plus the cycles until the first debt clears (Stabilise) or until all debts clear at the
  current total repayment (Attack). No estimate when nothing is being repaid.

### Payday and discovery

- **R24 Accepted top-ups.** `topUps` holds amounts accepted for this cycle (on payday) toward a commitment's or
  flexible debt's ideal. A commitment is budgeted at `min + topUp`, clamped to its ideal. A flexible debt's due rises
  by the top-up, clamped to `min(ideal, amountLeft)`. R10 suggestions then only offer the gap that remains.
- **R25 Discovery progress.** For a discovery cycle: `day` of `days`, a confidence of
  `round(100 × min(1, 0.7 × elapsed/days + 0.3 × loggedDays/elapsed))`, and per category the net spend so far. A
  category is learned after 3 spends on at least 2 days; its monthly estimate is `spent / elapsed × days`, rounded to
  NGN 1,000. At cycle close the figures are the real totals, rounded to NGN 100, and their sum becomes
  `everydayEstimate`.

### Attack and insights

- **R26 Snowball.** A cleared installment debt (amount left 0) keeps its `perCycle` going: it rolls onto the current
  attack target (R22) as `rolledIn`, capped at what that target has left after its own due. With nothing left to attack
  the payment is freed. Ideal top-up gaps (R10) ignore rolled-in money.
- **R27 Insights.** The rules layer turns the open cycle into ranked, structured insights: pace against the week's
  plan (after 2 days), last week's sweep, spread or borrow, a category above 40% of the week (3+ spends), a weekday
  averaging 2x the rest (after 10 days), a logging streak of 3+, a logging gap of 2+ days, payday within 3 days, and
  the attack target. Warnings outrank good news, which outranks information. Keys shown recently are skipped while at
  least 2 others remain; at most 3 are returned. Discovery drops pace and streak insights.
- **R28 Coach payload.** A review is about this week once it is 2+ days old, otherwise last week. Pace is decided
  here, not by the model: a finished week is behind if it went over and ahead if it swept a leftover; a week in
  progress is behind above 105% of its prorated budget (or over the whole budget) and ahead below 90%. The payload
  carries only aggregates, pre-formatted money, the top 5 categories with shares, event types, the phase, the tone,
  the attack target and the previous review's target. It never carries notes, merchants, individual spends or the
  user's identity.
- **R29 Check-ins.** Tomorrow's allowance is what's left of this week (never below 0) spread over the days after
  today, or next week's daily pace on a week's last day. The evening push always quotes it; drift only pushes when
  pace isn't on track, quoting the week's overspend when there is one; app-only never pushes.

### Money

- **R20 Integers.** All amounts are integer minor units. The only division points are R6, R7, R12 and R13, and each
  names its rounding.

## Outputs

`computeOpenCycle(input)` returns the Today and cycle numbers:

```ts
type OpenCycle = {
  cycle: { start; projectedEnd; days; dayIndex; overrunDays: number };
  plan: {
    salary;
    bills;
    sinking: { id; setAside }[];
    commitments: { id; amount }[];
    debts: { id; due; fromSavings; fromFlexible }[];
    savingsGoal;
    savingsPlanned;
    flexible;
  };
  weeks: Week[]; // as today: base, floor, budget, spent, status, outcome
  today: { spendToday; spentToday; dailyPace; leftThisWeek; daysLeftInWeek; strip: DayCell[] };
  savings: { planned; swept; sweptToDebts: { debtId; amount }[]; borrowed; net };
  suggestions: ({ kind: "idealTopUp"; id; amount } | { kind: "splitDebt"; debtId })[];
  events: EngineEvent[];
};

type EngineEvent =
  | { type: "sweep"; week: number; amount: Minor; to: "savings" | string }
  | { type: "carryForward"; week: number; amount: Minor }
  | { type: "borrowedFromSavings"; week: number; amount: Minor }
  | { type: "overcommitted"; shortfall: Minor }
  | { type: "tight"; flexible: Minor }
  | { type: "debtSqueezesSavings"; amount: Minor }
  | { type: "salaryOverdue"; daysLate: number };
```

`closeCycle(input, closedOn)` returns the final snapshot the API stores: totals spent, swept (by destination),
borrowed (including R18), savings rate `(savingsPlanned + swept − borrowed) / salary`, each debt's new `amountLeft`,
each debt's unpaid amount (due minus payments, rolled forward and flagged overdue), each sinking fund's new `saved`, and `engineVersion`. Closing is idempotent: the same input gives the same snapshot.

Events are the rules layer's output. The personality layer turns them into copy; the engine never produces text.

## Test cases

Fixture unless stated: salary NGN 400,000, savings 10%, min savings 5%, floor 70%, Monday weeks, no bills.

| #   | Rule    | Case                                                                       | Expect                                                                          |
| --- | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | R2      | Payday 31, salary marked 30 Sep 2026                                       | Projected end 30 Oct                                                            |
| 2   | R2      | Payday 31, marked 28 Feb 2026 / 29 Feb 2028                                | Projected end 30 Mar in both                                                    |
| 3   | R2      | Payday 31, marked 31 Dec 2026                                              | Projected end 30 Jan 2027                                                       |
| 4   | R1, R11 | Salary lands a day early, on a Wednesday                                   | Cycle starts Wednesday; first week is Wed–Sun (5 days)                          |
| 5   | R4      | Today is 3 days past projected end, nothing marked                         | `overrunDays` 3, final week leftover shared over them, `salaryOverdue`          |
| 6   | R4      | 1 day past expected payday                                                 | No `salaryOverdue` yet                                                          |
| 7   | R12     | 31-day cycle starting Tuesday                                              | Week budgets sum exactly to flexible; remainder on the last week                |
| 8   | R13     | Spend on Monday, check Tuesday                                             | Allowance = (budget − Monday spend) ÷ 6                                         |
| 9   | R13     | Spend today                                                                | `spendToday` drops by the amount; `dailyPace` unchanged                         |
| 10  | R15     | Week under budget, no choice                                               | Leftover swept to savings                                                       |
| 11  | R15     | Week under budget, choice = debt                                           | Sweep recorded against the debt; savings not credited                           |
| 12  | R16     | Small overspend in week 1                                                  | Spread across later weeks by size; none below floor; no borrowing               |
| 13  | R17     | Overspend larger than all room above the floors                            | Later weeks at floor; remainder borrowed; `floorHit`                            |
| 14  | R18     | Overspend in the final week                                                | Shown as negative left this week; borrowed at close                             |
| 15  | R19     | Back-dated spend makes a swept week overspent                              | Week outcome flips to carry-forward; later weeks shrink                         |
| 16  | R14     | Refund after a spend on the same day                                       | Net day spend reduced; allowance recalculated                                   |
| 17  | R5, R6  | **Debt: none**                                                             | `savingsPlanned` = goal; flexible unchanged                                     |
| 18  | R6      | **Debt absorbed by savings**: NGN 15,000 due                               | `fromSavings` 15,000; savings 25,000; flexible unchanged                        |
| 19  | R6      | **Debt spills into flexible**: NGN 50,000 due                              | `fromSavings` 20,000 (down to 5%); `fromFlexible` 30,000; `debtSqueezesSavings` |
| 20  | R9      | **Debt exceeds everything**: NGN 500,000 one-off due                       | Flexible 0; `overcommitted` shortfall 120,000; `splitDebt` suggestion           |
| 21  | R5      | One-off debt due next cycle                                                | Due 0 this cycle                                                                |
| 22  | R5      | Installments larger than amount left                                       | Due = amount left                                                               |
| 23  | R7      | Rent NGN 600,000 due in 6 cycles, NGN 0 saved                              | Set-aside 100,000 per cycle                                                     |
| 24  | R7      | Sinking fund already funded or overdue                                     | Set-aside 0                                                                     |
| 25  | R8, R10 | Support min 20,000, ideal 50,000; everyday estimate leaves 40,000 headroom | Budgeted 20,000; `idealTopUp` 30,000                                            |
| 26  | R10     | Everyday estimate unknown                                                  | No top-up suggestions                                                           |
| 27  | R9      | Flexible under 10% of salary                                               | `tight` event                                                                   |
| 28  | close   | Close the same input twice                                                 | Identical snapshots                                                             |
| 29  | close   | Savings rate with sweeps and a borrow                                      | `(planned + swept − borrowed) / salary`                                         |

## Open questions (defaults used above)

1. **Late salary (R4):** overrun days share the final week's leftover. Alternative: borrow a small daily amount from
   savings for each overrun day.
2. **Carry-forward split (R16):** by week size, not "evenly", so a 2-day final week isn't hit as hard as a full week.
3. **Tight threshold (R9):** 10% of salary.
4. **Sweep to debt (R15):** reduces the debt at close but doesn't lower this cycle's planned repayment.
5. **Refunds (R14):** included now so returns don't need a fake negative spend. Drop if you'd rather keep v1 to spends.
6. **Sinking fund cadence (R7):** counts paydays, so a fund due mid-cycle is fully set aside in that cycle.
