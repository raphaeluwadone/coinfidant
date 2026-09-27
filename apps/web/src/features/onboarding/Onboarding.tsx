import type { OnboardingInput } from "@coinfidant/contracts";
import { localDate } from "@coinfidant/engine";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type ComponentType, useMemo, useReducer, useState } from "react";
import { api } from "../../lib/api";
import { budgetQuery } from "../../lib/budget";
import { todayQuery, type TodayData } from "../../lib/today";
import { Reveal, usePlanPreview } from "./Reveal";
import { type Answers, initialAnswers, toPayload } from "./state";
import { BigBills, Bills, Debts, Everyday, Goals, Leaks, OnTrack, Payday, type StepProps, Welcome } from "./steps";
import "./Onboarding.css";

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos";
const TOTAL = 10;

type Step = {
  Component: ComponentType<StepProps>;
  skippable?: (keyof Answers)[];
  canContinue?: (a: Answers) => boolean;
};

const STEPS: Step[] = [
  { Component: Welcome },
  { Component: Payday, canContinue: (a) => a.salary > 0 },
  { Component: Bills, skippable: ["bills"] },
  { Component: BigBills, skippable: ["sinkingFunds"] },
  { Component: Debts, skippable: ["debts"] },
  { Component: Goals, skippable: ["goals", "commitments"] },
  {
    Component: Everyday,
    skippable: ["everydayEstimate", "discovery"],
    canContinue: (a) => a.discovery || a.everydayEstimate > 0,
  },
  { Component: Leaks },
  { Component: OnTrack },
];

const saveOnboarding = (body: OnboardingInput) => api<TodayData>("/onboarding", { method: "POST", json: body });

export function Onboarding() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const today = useMemo(() => localDate(new Date(), TZ), []);
  const [a, set] = useReducer((s: Answers, patch: Partial<Answers>) => ({ ...s, ...patch }), initialAnswers);
  const [step, setStep] = useState(1);
  // Set once the plan has been revealed: edits then jump straight back to it.
  const [seenPlan, setSeenPlan] = useState(false);
  const { reading } = usePlanPreview(a, today);

  const save = useMutation({
    mutationFn: () => saveOnboarding(toPayload(a, today, TZ)),
    onSuccess: async (res) => {
      qc.setQueryData(todayQuery.queryKey, res);
      await qc.invalidateQueries({ queryKey: budgetQuery.queryKey });
      navigate({ to: res.budget.discovery ? "/discovery/intro" : "/" });
    },
  });

  const current = STEPS[step - 1];
  const scheme = step === 9 ? "dark" : step === TOTAL ? "phase" : "light";
  const next = () => {
    const to = seenPlan ? TOTAL : Math.min(TOTAL, step + 1);
    if (to === TOTAL) setSeenPlan(true);
    setStep(to);
  };
  const editStep = (n: number) => {
    setSeenPlan(true);
    setStep(n);
  };

  const skip = () => {
    const cleared = Object.fromEntries((current?.skippable ?? []).map((k) => [k, initialAnswers[k]]));
    set(cleared);
    next();
  };

  return (
    <div className="ob" data-scheme={scheme} data-phase={step === TOTAL ? reading.phase : undefined}>
      <main className="ob-screen">
        {step === TOTAL && (
          <div className="ob-top">
            <button className="ob-back" onClick={() => setStep(TOTAL - 1)} aria-label="Back">
              ←
            </button>
          </div>
        )}
        {step < TOTAL && (
          <div className="ob-top">
            {step > 1 && (
              <button className="ob-back" onClick={() => setStep((s) => s - 1)} aria-label="Back">
                ←
              </button>
            )}
            <div className="ob-rail" role="progressbar" aria-valuemin={1} aria-valuemax={TOTAL} aria-valuenow={step}>
              <div key={step} className="ob-rail__fill" style={{ width: `${(step / TOTAL) * 100}%` }} />
            </div>
          </div>
        )}

        {current ? (
          <>
            <div key={step} className="ob-body">
              <current.Component a={a} set={set} today={today} />
            </div>
            <div className="ob-foot">
              <button
                className="btn ob-continue"
                onClick={next}
                disabled={current.canContinue ? !current.canContinue(a) : false}
              >
                {seenPlan ? "Back to my plan" : step === 1 ? "Let's go" : "Continue"}
              </button>
              {current.skippable && (
                <button className="link-btn ob-skip" onClick={skip}>
                  Skip for now
                </button>
              )}
            </div>
          </>
        ) : (
          <Reveal
            a={a}
            today={today}
            saving={save.isPending}
            error={save.isError}
            onConfirm={() => save.mutate()}
            onEdit={editStep}
          />
        )}
      </main>
    </div>
  );
}
