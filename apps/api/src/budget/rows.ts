import type { commitmentInput, debtInput } from "@coinfidant/contracts";
import type { z } from "zod";

export const debtRow = (d: z.output<typeof debtInput>) => ({
  name: d.name,
  creditor: d.creditor,
  amountLeft: d.amountLeft,
  hasInterest: d.hasInterest,
  plan: d.plan.kind,
  dueDate: d.plan.kind === "oneOff" ? d.plan.due : null,
  perCycle: d.plan.kind === "installments" ? d.plan.perCycle : null,
  minAmount: d.plan.kind === "flexible" ? d.plan.min : null,
  idealAmount: d.plan.kind === "flexible" ? d.plan.ideal : null,
});

export const commitmentRow = (c: z.output<typeof commitmentInput>) => ({
  name: c.name,
  minAmount: c.min,
  idealAmount: c.ideal,
});
