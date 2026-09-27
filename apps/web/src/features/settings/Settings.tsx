import { sweepPreview, TONES, type Tone } from "@coinfidant/engine";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { logout, meQuery } from "@/lib/auth";
import { type BudgetData, budgetQuery, savePreferences, saveSettings } from "@/lib/budget";
import { disablePush } from "@/lib/push";
import { getTheme, setTheme, type ThemeChoice } from "@/lib/theme";
import { todayQuery } from "@/lib/today";
import { cn } from "@/lib/utils";
import { Notifications, YourData } from "./AccountSections";
import { ErrorNote, Row, Section } from "./parts";

const CURRENCIES = [
  { code: "NGN", name: "Naira" },
  { code: "USD", name: "US dollar" },
  { code: "GBP", name: "Pound sterling" },
  { code: "EUR", name: "Euro" },
] as const;
type Currency = (typeof CURRENCIES)[number]["code"];

const THEMES: { key: ThemeChoice; label: string }[] = [
  { key: "system", label: "🖥️ System" },
  { key: "light", label: "☀️ Light" },
  { key: "dark", label: "🌙 Dark" },
];

const CHECKINS = [
  { key: "evening", label: "🌙 Evening check-in" },
  { key: "drift", label: "📉 Drift alerts" },
  { key: "app", label: "🤐 Just let me open the app" },
] as const;
type Checkin = (typeof CHECKINS)[number]["key"];

export function Settings() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery(budgetQuery);
  const [theme, pickTheme] = useState(getTheme);

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: budgetQuery.queryKey }),
      qc.invalidateQueries({ queryKey: todayQuery.queryKey }),
    ]);
  const prefs = useMutation({
    mutationFn: savePreferences,
    onMutate: (patch) =>
      qc.setQueryData<BudgetData | null>(budgetQuery.queryKey, (d) =>
        d ? { ...d, prefs: { ...d.prefs, ...patch } } : d,
      ),
    onSettled: refresh,
  });
  const settings = useMutation({
    mutationFn: saveSettings,
    onMutate: (patch) =>
      qc.setQueryData<BudgetData | null>(budgetQuery.queryKey, (d) =>
        d ? { ...d, budget: { ...d.budget, ...patch } } : d,
      ),
    onSettled: refresh,
  });

  if (!data) return <div className="mx-auto max-w-[560px]" aria-busy="true" />;
  const { budget, prefs: me } = data;
  const preview = sweepPreview(4_200_00);

  return (
    <div className="mx-auto grid max-w-[560px] content-start gap-[22px]">
      <BackButton />
      <h1 className="m-0 text-lg font-bold">Settings</h1>

      <Section title="Personality" hint="How much sass do you want?">
        <ToggleGroup
          type="single"
          value={me.personality}
          onValueChange={(v) => v && prefs.mutate({ personality: v as Tone })}
          aria-label="Personality"
          className="p-1"
        >
          {TONES.map((t) => (
            <ToggleGroupItem key={t.key} value={t.key} className="flex-1 py-2.5 text-[13px]">
              {t.emoji} {t.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="mt-1.5 text-xs font-semibold tracking-wide text-muted-foreground">
          LIVE PREVIEW: SAME MOMENT, THREE VOICES
        </div>
        {TONES.map((t) => (
          <Preview key={t.key} tone={t.key} line={preview[t.key]} selected={me.personality === t.key} />
        ))}
      </Section>

      <Section title="Appearance">
        <Row title="Theme" hint="Saved on this device">
          <ToggleGroup
            type="single"
            value={theme}
            onValueChange={(v) => {
              if (!v) return;
              setTheme(v as ThemeChoice);
              pickTheme(v as ThemeChoice);
            }}
            aria-label="Theme"
          >
            {THEMES.map((t) => (
              <ToggleGroupItem key={t.key} value={t.key}>
                {t.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Row>
      </Section>

      <Section title="Currency">
        <Row title="Currency">
          <Select value={budget.currency} onValueChange={(v) => settings.mutate({ currency: v as Currency })}>
            <SelectTrigger className="h-10 w-auto border-0 bg-transparent px-0 text-[13px] font-semibold text-accent-foreground">
              <SelectValue aria-label="Currency" />
            </SelectTrigger>
            <SelectContent align="end">
              {CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name} ({c.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
      </Section>

      <Section title="Payday and leftovers">
        <Row title="💸 Payday mode" hint="Feed the responsibilities before showing what's yours">
          <Switch
            checked={budget.paydayMode}
            onCheckedChange={(on) => settings.mutate({ paydayMode: on })}
            aria-label="Payday mode"
          />
        </Row>
        <Row title="Weekly leftovers go to">
          <ToggleGroup
            type="single"
            value={budget.leftoverDefault}
            onValueChange={(v) => v && settings.mutate({ leftoverDefault: v as "debts" | "savings" })}
            aria-label="Weekly leftovers"
          >
            <ToggleGroupItem value="debts">⚔️ Debts</ToggleGroupItem>
            <ToggleGroupItem value="savings">🌱 Savings</ToggleGroupItem>
          </ToggleGroup>
        </Row>
        <Row title="Check-ins">
          <Select value={me.checkinMethod} onValueChange={(v) => prefs.mutate({ checkinMethod: v as Checkin })}>
            <SelectTrigger className="h-10 w-auto min-w-44 text-sm">
              <SelectValue aria-label="Check-ins" />
            </SelectTrigger>
            <SelectContent align="end">
              {CHECKINS.map((c) => (
                <SelectItem key={c.key} value={c.key}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
        {me.checkinMethod !== "app" && <Notifications />}
      </Section>

      <YourData />

      <section className="grid gap-2.5">
        <Link to="/setup" className="rounded-tile text-foreground no-underline">
          <Row title="Edit plan: salary, payday, bills" className="transition-colors hover:bg-secondary">
            <span className="text-[13px] font-semibold text-accent-foreground">›</span>
          </Row>
        </Link>
        <Button
          variant="muted"
          size="inline"
          className="justify-self-center"
          onClick={async () => {
            await disablePush().catch(() => {});
            await logout();
            qc.clear();
            qc.setQueryData(meQuery.queryKey, null);
            navigate({ to: "/login" });
          }}
        >
          Log out
        </Button>
      </section>

      {(prefs.isError || settings.isError) && (
        <ErrorNote>That didn't save. Check your connection and try again.</ErrorNote>
      )}
    </div>
  );
}

function Preview({ tone, line, selected }: { tone: Tone; line: string; selected: boolean }) {
  const t = TONES.find((x) => x.key === tone)!;
  return (
    <Card
      className={cn(
        "border-2 border-transparent px-4 py-3.5 opacity-60 shadow-none transition-opacity",
        selected && "border-accent-foreground opacity-100",
      )}
    >
      <div
        className={cn(
          "mb-1 text-[11px] font-bold text-muted-foreground",
          selected && "font-extrabold text-accent-foreground",
        )}
      >
        {t.emoji} {t.label.toUpperCase()}
        {selected ? ", SELECTED" : ""}
      </div>
      <div className={cn("text-sm font-semibold text-soft", selected && "font-bold text-foreground")}>{line}</div>
    </Card>
  );
}
