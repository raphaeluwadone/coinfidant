import { computeOpenCycle, cycleStartFor, formatMoney, hasEvent, localDate } from "@coinfidant/engine";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { BackButton } from "@/components/BackButton";
import { Mascot } from "@/components/Mascot";
import { MoneyInput } from "@/components/MoneyInput";
import { Button } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { logout, meQuery } from "@/lib/auth";
import { type Bill, type BudgetData, budgetQuery, salaryOf, saveSetup } from "@/lib/budget";
import "./SetupForm.css";

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos";

export function SetupForm({ initial }: { initial: BudgetData | null }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const today = useMemo(() => localDate(new Date(), TZ), []);
  const [salary, setSalary] = useState(initial ? salaryOf(initial.budget) : 0);
  const [payday, setPayday] = useState(initial?.budget.expectedPayday ?? 31);
  const [savingsPercent, setSavings] = useState(initial?.budget.savingsPercent ?? 10);
  const [bills, setBills] = useState<Bill[]>(initial?.budget.bills ?? [{ name: "Rent", amount: 0 }]);
  const [pickedSalaryOn, setLastSalaryOn] = useState<string | null>(null);
  const lastSalaryOn = pickedSalaryOn ?? cycleStartFor(today, payday);
  const cycleStart = initial?.openCycle?.startDate ?? lastSalaryOn;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const validBills = useMemo(() => bills.filter((b) => b.name.trim() && b.amount > 0), [bills]);

  const preview = useMemo(() => {
    if (salary <= 0) return null;
    return computeOpenCycle({
      today,
      settings: {
        savingsPercent,
        minSavingsPercent: 5,
        floorPercent: 70,
        weekStart: 0,
        expectedPayday: payday,
        everydayEstimate: null,
        leftoverDefault: "savings",
      },
      cycle: { start: cycleStart, salary },
      bills: validBills.map((b, i) => ({ id: String(i), ...b })),
      sinkingFunds: [],
      debts: [],
      commitments: [],
      transactions: [],
      sweepChoices: {},
      debtPayments: [],
    });
  }, [salary, validBills, savingsPercent, payday, today, cycleStart]);

  const overcommitted = preview ? hasEvent(preview, "overcommitted") : false;
  const perWeek = preview ? Math.round((preview.plan.flexible / preview.cycle.days) * 7) : 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await saveSetup({
        salary,
        expectedPayday: payday,
        savingsPercent,
        timezone: TZ,
        bills: validBills.map(({ name, amount }) => ({ name: name.trim(), amount })),
        ...(initial ? {} : { lastSalaryOn }),
      });
      await qc.invalidateQueries({ queryKey: budgetQuery.queryKey });
      await qc.invalidateQueries({ queryKey: ["today"] });
      navigate({ to: "/" });
    } catch {
      setError("Couldn't save that. Check the numbers and try again.");
    } finally {
      setBusy(false);
    }
  }

  const updateBill = (i: number, patch: Partial<Bill>) =>
    setBills((bs) => bs.map((b, k) => (k === i ? { ...b, ...patch } : b)));

  return (
    <main className="setup">
      {initial && <BackButton fallback="/settings" />}
      <header className="setup__head">
        <Mascot size={56} />
        <h1>{initial ? "Your plan" : "Let's set up your plan"}</h1>
        <p>Salary in, bills and savings out, the rest becomes weekly budgets.</p>
      </header>

      <form className="setup__form" onSubmit={onSubmit}>
        <Card asChild className="setup__section">
          <section>
            <Field label="Monthly take-home pay">
              <MoneyInput value={salary} onChange={setSalary} required aria-label="Monthly take-home pay" />
            </Field>
            <div className="grid gap-1.5">
              <Eyebrow>Payday</Eyebrow>
              <Select value={String(payday)} onValueChange={(v) => setPayday(Number(v))}>
                <SelectTrigger aria-label="Payday">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d === 31 ? "Last day of the month" : `${d}${ordinal(d)} of the month`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!initial && (
              <Field label="When did your last salary land?">
                <Input
                  type="date"
                  value={lastSalaryOn}
                  max={today}
                  required
                  onChange={(e) => e.target.value && setLastSalaryOn(e.target.value)}
                />
              </Field>
            )}
          </section>
        </Card>

        <Card asChild className="setup__section">
          <section>
            <Eyebrow>Fixed bills</Eyebrow>
            {bills.map((b, i) => (
              <div className="bill-row" key={i}>
                <Input
                  placeholder="Bill name"
                  value={b.name}
                  maxLength={40}
                  onChange={(e) => updateBill(i, { name: e.target.value })}
                  aria-label={`Bill ${i + 1} name`}
                />
                <MoneyInput
                  value={b.amount}
                  onChange={(amount) => updateBill(i, { amount })}
                  aria-label={`Bill ${i + 1} amount`}
                />
                <Button
                  variant="soft"
                  size="icon"
                  className="text-xl"
                  aria-label={`Remove ${b.name || "bill"}`}
                  onClick={() => setBills((bs) => bs.filter((_, k) => k !== i))}
                >
                  ×
                </Button>
              </div>
            ))}
            <Button
              variant="link"
              size="inline"
              className="justify-self-start"
              onClick={() => setBills((bs) => [...bs, { name: "", amount: 0 }])}
            >
              + Add a bill
            </Button>
          </section>
        </Card>

        <Card asChild className="setup__section">
          <section>
            <div className="setup__row">
              <Eyebrow>Save each month</Eyebrow>
              <strong>{savingsPercent}%</strong>
            </div>
            <Slider
              min={0}
              max={50}
              step={1}
              value={[savingsPercent]}
              onValueChange={([v]) => v !== undefined && setSavings(v)}
              aria-label="Savings percent"
            />
            {preview && <p className="setup__hint">That's {formatMoney(preview.plan.savingsPlanned)} to Future You.</p>}
          </section>
        </Card>

        {preview && (
          <Card asChild className={`setup__preview ${overcommitted ? "is-warn" : ""}`}>
            <section>
              {overcommitted ? (
                <p>Bills and savings are more than your pay. Trim something so there's room to live.</p>
              ) : (
                <>
                  <Eyebrow>You'll have about</Eyebrow>
                  <strong className="setup__big">{formatMoney(perWeek)}</strong>
                  <span className="setup__hint">a week to spend, {formatMoney(preview.plan.flexible)} this cycle.</span>
                </>
              )}
            </section>
          </Card>
        )}

        {error && (
          <p className="setup__error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy || salary <= 0 || overcommitted}>
          {initial ? "Save plan" : "Start budgeting"}
        </Button>
      </form>

      {initial && (
        <Button
          variant="muted"
          size="inline"
          className="justify-self-center"
          onClick={async () => {
            await logout();
            qc.clear();
            qc.setQueryData(meQuery.queryKey, null);
            navigate({ to: "/login" });
          }}
        >
          Log out
        </Button>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <Eyebrow>{label}</Eyebrow>
      {children}
    </label>
  );
}

function ordinal(n: number) {
  if (n >= 11 && n <= 13) return "th";
  return ["th", "st", "nd", "rd"][n % 10] ?? "th";
}
