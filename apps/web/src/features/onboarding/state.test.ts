import { onboardingInput } from "@coinfidant/contracts";
import { computeOpenCycle, detectPhase } from "@coinfidant/engine";
import { describe, expect, it } from "vitest";
import { type Answers, billEmoji, initialAnswers, previewInput, toPayload } from "./state";

const NGN = (n: number) => n * 100;
const TODAY = "2026-09-24";

const full: Answers = {
  ...initialAnswers,
  personality: "unhinged",
  salary: NGN(1_000_000),
  expectedPayday: 31,
  bills: [{ name: "Data", amount: NGN(100_000) }],
  sinkingFunds: [{ name: "Rent", target: NGN(700_000), dueDate: "2027-03-01", perCycle: null }],
  debts: [
    {
      name: "OPay",
      creditor: "Loan app",
      amountLeft: NGN(88_000),
      hasInterest: true,
      plan: { kind: "installments", perCycle: NGN(22_000) },
    },
  ],
  goals: [{ name: "Japa fund", emoji: "✈️", target: NGN(2_400_000) }],
  commitments: [{ name: "Sister", min: NGN(20_000), ideal: NGN(50_000) }],
  everydayEstimate: NGN(150_000),
  overspendTimes: ["afterPayday"],
  leftoverDefault: "debts",
};

describe("onboarding answers", () => {
  it("always produce a payload the API accepts", () => {
    expect(onboardingInput.safeParse(toPayload(full, TODAY, "Africa/Lagos")).success).toBe(true);
    const skipped = { ...initialAnswers, salary: NGN(300_000), discovery: true };
    const payload = toPayload(skipped, TODAY, "Africa/Lagos");
    expect(onboardingInput.safeParse(payload).success).toBe(true);
    expect(payload).toMatchObject({ discovery: true, everydayEstimate: null, lastSalaryOn: "2026-08-31" });
  });

  it("preview the same plan the API will compute", () => {
    const open = computeOpenCycle(previewInput(full, TODAY));
    // 1,000,000 - 100,000 bills - 100,000 rent set-aside - 20,000 sister - 22,000 loan - 78,000 savings (100,000 - 22,000)
    expect(open.plan.savingsPlanned).toBe(NGN(78_000));
    expect(open.plan.flexible).toBe(NGN(1_000_000 - 100_000 - 100_000 - 20_000 - 22_000 - 78_000));
    expect(detectPhase(previewInput(full, TODAY), open).phase).toBe("attack");
  });

  it("guesses bill emoji from the name", () => {
    expect(billEmoji("NEPA light")).toBe("💡");
    expect(billEmoji("Spotify")).toBe("🎧");
    expect(billEmoji("Something else")).toBe("🧾");
  });
});
