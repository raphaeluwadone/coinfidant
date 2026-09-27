import { TONES, type Tone } from "@coinfidant/engine";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type BudgetData, budgetQuery, savePreferences } from "@/lib/budget";
import { todayQuery, type TodayData } from "@/lib/today";

/** The tone dial, where the design keeps it: in the header of Today and Transactions. */
export function PersonalitySwitch({ current }: { current: Tone }) {
  const qc = useQueryClient();
  const prefs = useMutation({
    mutationFn: savePreferences,
    // Both caches carry prefs; updating both makes the whole page change voice at once.
    onMutate: (patch) => {
      qc.setQueryData<BudgetData | null>(budgetQuery.queryKey, (d) =>
        d ? { ...d, prefs: { ...d.prefs, ...patch } } : d,
      );
      qc.setQueryData<TodayData>(todayQuery.queryKey, (d) => (d ? { ...d, prefs: { ...d.prefs, ...patch } } : d));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: todayQuery.queryKey }),
  });
  return (
    <div className="hidden gap-2 min-[1000px]:grid">
      <span className="text-[11px] font-bold tracking-[0.18em] text-muted-foreground uppercase">Personality</span>
      <ToggleGroup
        type="single"
        value={current}
        onValueChange={(v) => v && prefs.mutate({ personality: v as Tone })}
        aria-label="Personality"
        className="border border-border bg-card p-1"
      >
        {TONES.map((x) => (
          <ToggleGroupItem
            key={x.key}
            value={x.key}
            className="px-4 py-2 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            {x.emoji} {x.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
