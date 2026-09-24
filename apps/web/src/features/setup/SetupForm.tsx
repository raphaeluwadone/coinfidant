import { computeSnapshot, formatMoney, localDate } from "@coinfidant/engine";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { Mascot } from "../../components/Mascot";
import { MoneyInput } from "../../components/MoneyInput";
import { logout, meQuery } from "../../lib/auth";
import { type Bill, type Profile, profileQuery, saveProfile } from "../../lib/profile";
import "./SetupForm.css";

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos";

export function SetupForm({ initial }: { initial: Profile | null }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [salary, setSalary] = useState(initial?.salary ?? 0);
  const [payday, setPayday] = useState(initial?.payday ?? 31);
  const [savingsPercent, setSavings] = useState(initial?.savingsPercent ?? 10);
  const [bills, setBills] = useState<Bill[]>(initial?.bills ?? [{ name: "Rent", amount: 0 }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const validBills = useMemo(() => bills.filter((b) => b.name.trim() && b.amount > 0), [bills]);

  const preview = useMemo(() => {
    if (salary <= 0) return null;
    const today = localDate(new Date(), TZ);
    return computeSnapshot({ salary, bills: validBills, savingsPercent, payday }, [], today);
  }, [salary, validBills, savingsPercent, payday]);

  const perWeek = preview ? Math.round((preview.plan.spendable / preview.cycle.days) * 7) : 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const profile = await saveProfile({
        salary,
        payday,
        savingsPercent,
        timezone: TZ,
        bills: validBills.map(({ name, amount }) => ({ name: name.trim(), amount })),
      });
      qc.setQueryData(profileQuery.queryKey, profile);
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
      <header className="setup__head">
        <Mascot size={56} />
        <h1>{initial ? "Your plan" : "Let's set up your plan"}</h1>
        <p>Salary in, bills and savings out, the rest becomes weekly budgets.</p>
      </header>

      <form className="setup__form" onSubmit={onSubmit}>
        <section className="card setup__section">
          <label className="field">
            <span className="label">Monthly take-home pay</span>
            <MoneyInput value={salary} onChange={setSalary} required aria-label="Monthly take-home pay" />
          </label>
          <label className="field">
            <span className="label">Payday</span>
            <select className="select" value={payday} onChange={(e) => setPayday(Number(e.target.value))}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d === 31 ? "Last day of the month" : `${d}${ordinal(d)} of the month`}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="card setup__section">
          <span className="label">Fixed bills</span>
          {bills.map((b, i) => (
            <div className="bill-row" key={i}>
              <input
                className="text-input"
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
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove ${b.name || "bill"}`}
                onClick={() => setBills((bs) => bs.filter((_, k) => k !== i))}
              >
                ×
              </button>
            </div>
          ))}
          <button type="button" className="link-btn" onClick={() => setBills((bs) => [...bs, { name: "", amount: 0 }])}>
            + Add a bill
          </button>
        </section>

        <section className="card setup__section">
          <div className="setup__row">
            <span className="label">Save each month</span>
            <strong>{savingsPercent}%</strong>
          </div>
          <input
            type="range"
            min={0}
            max={50}
            value={savingsPercent}
            onChange={(e) => setSavings(Number(e.target.value))}
            aria-label="Savings percent"
          />
          {preview && <p className="setup__hint">That's {formatMoney(preview.plan.savings)} to Future You.</p>}
        </section>

        {preview && (
          <section className={`card setup__preview ${preview.warnings.length ? "is-warn" : ""}`}>
            {preview.warnings.includes("overcommitted") ? (
              <p>Bills and savings are more than your pay. Trim something so there's room to live.</p>
            ) : (
              <>
                <span className="label">You'll have about</span>
                <strong className="setup__big">{formatMoney(perWeek)}</strong>
                <span className="setup__hint">a week to spend, {formatMoney(preview.plan.spendable)} this cycle.</span>
              </>
            )}
          </section>
        )}

        {error && (
          <p className="setup__error" role="alert">
            {error}
          </p>
        )}
        <button className="btn" type="submit" disabled={busy || salary <= 0 || !!preview?.warnings.length}>
          {initial ? "Save plan" : "Start budgeting"}
        </button>
      </form>

      {initial && (
        <button
          type="button"
          className="link-btn setup__logout"
          onClick={async () => {
            await logout();
            qc.clear();
            qc.setQueryData(meQuery.queryKey, null);
            navigate({ to: "/login" });
          }}
        >
          Log out
        </button>
      )}
    </main>
  );
}

function ordinal(n: number) {
  if (n >= 11 && n <= 13) return "th";
  return ["th", "st", "nd", "rd"][n % 10] ?? "th";
}
