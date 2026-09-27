import { useQuery } from "@tanstack/react-query";
import { Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { budgetQuery } from "@/lib/budget";
import { todayQuery } from "@/lib/today";

/**
 * Puts the current phase on <html>, so every screen (full-screen flows included) takes that phase's palette.
 * During discovery the phase is still a guess, so the default palette stays.
 */
export function PhaseFrame() {
  const { data: budget } = useQuery(budgetQuery);
  const { data } = useQuery({ ...todayQuery, enabled: !!budget });
  const phase = data && !data.budget.discovery ? data.phase?.phase : undefined;
  useEffect(() => {
    const root = document.documentElement;
    if (phase) root.dataset.phase = phase;
    else delete root.dataset.phase;
  }, [phase]);
  return <Outlet />;
}
