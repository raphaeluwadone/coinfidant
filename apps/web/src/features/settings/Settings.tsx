import { sweepPreview, TONES, type Tone } from "@coinfidant/engine";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BackButton } from "../../components/BackButton";
import { logout, meQuery } from "../../lib/auth";
import { type BudgetData, budgetQuery, savePreferences, saveSettings } from "../../lib/budget";
import { disablePush } from "../../lib/push";
import { getTheme, setTheme, type ThemeChoice } from "../../lib/theme";
import { todayQuery } from "../../lib/today";
import { Notifications, YourData } from "./AccountSections";
import "./Settings.css";

const CURRENCIES = [
  { code: "NGN", name: "Naira" },
  { code: "USD", name: "US dollar" },
  { code: "GBP", name: "Pound sterling" },
  { code: "EUR", name: "Euro" },
] as const;

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

  if (!data) return <div className="settings" aria-busy="true" />;
  const { budget, prefs: me } = data;
  const preview = sweepPreview(4_200_00);

  return (
    <div className="settings">
      <BackButton />
      <h1>Settings</h1>

      <section>
        <h2>Personality</h2>
        <p className="settings__hint">How much sass do you want?</p>
        <div className="dial" role="radiogroup" aria-label="Personality">
          {TONES.map((t) => (
            <button
              key={t.key}
              role="radio"
              aria-checked={me.personality === t.key}
              className={me.personality === t.key ? "is-on" : ""}
              onClick={() => prefs.mutate({ personality: t.key })}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
        <div className="settings__label">LIVE PREVIEW: SAME MOMENT, THREE VOICES</div>
        {TONES.map((t) => (
          <Preview key={t.key} tone={t.key} line={preview[t.key]} selected={me.personality === t.key} />
        ))}
      </section>

      <section>
        <h2>Appearance</h2>
        <div className="card settings__row">
          <span>
            Theme
            <small>Saved on this device</small>
          </span>
          <div className="seg" role="radiogroup" aria-label="Theme">
            {THEMES.map((t) => (
              <button
                key={t.key}
                role="radio"
                aria-checked={theme === t.key}
                className={theme === t.key ? "is-on" : ""}
                onClick={() => {
                  setTheme(t.key);
                  pickTheme(t.key);
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h2>Currency</h2>
        <label className="card settings__row">
          <span>
            {CURRENCIES.find((c) => c.code === budget.currency)?.name} ({budget.currency})
          </span>
          <span className="settings__change">Change ›</span>
          <select
            className="settings__select"
            value={budget.currency}
            onChange={(e) => settings.mutate({ currency: e.target.value as (typeof CURRENCIES)[number]["code"] })}
            aria-label="Currency"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </label>
      </section>

      <section>
        <h2>Payday and leftovers</h2>
        <label className="card settings__row">
          <span>
            💸 Payday mode
            <small>Feed the responsibilities before showing what's yours</small>
          </span>
          <input
            type="checkbox"
            className="switch"
            checked={budget.paydayMode}
            onChange={(e) => settings.mutate({ paydayMode: e.target.checked })}
          />
        </label>
        <div className="card settings__row">
          <span>Weekly leftovers go to</span>
          <div className="seg" role="radiogroup" aria-label="Weekly leftovers">
            {(
              [
                ["debts", "⚔️ Debts"],
                ["savings", "🌱 Savings"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                role="radio"
                aria-checked={budget.leftoverDefault === k}
                className={budget.leftoverDefault === k ? "is-on" : ""}
                onClick={() => settings.mutate({ leftoverDefault: k })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <label className="card settings__row">
          <span>Check-ins</span>
          <select
            className="select"
            value={me.checkinMethod}
            onChange={(e) => prefs.mutate({ checkinMethod: e.target.value as (typeof CHECKINS)[number]["key"] })}
          >
            {CHECKINS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        {me.checkinMethod !== "app" && <Notifications />}
      </section>

      <YourData />

      <section className="settings__links">
        <Link to="/setup" className="card settings__row settings__link">
          <span>Edit plan: salary, payday, bills</span>
          <span className="settings__change">›</span>
        </Link>
        <button
          className="link-btn settings__logout"
          onClick={async () => {
            await disablePush().catch(() => {});
            await logout();
            qc.clear();
            qc.setQueryData(meQuery.queryKey, null);
            navigate({ to: "/login" });
          }}
        >
          Log out
        </button>
      </section>

      {(prefs.isError || settings.isError) && (
        <p className="settings__error" role="alert">
          That didn't save. Check your connection and try again.
        </p>
      )}
    </div>
  );
}

function Preview({ tone, line, selected }: { tone: Tone; line: string; selected: boolean }) {
  const t = TONES.find((x) => x.key === tone)!;
  return (
    <div className={`card preview ${selected ? "is-on" : ""}`}>
      <div className="preview__label">
        {t.emoji} {t.label.toUpperCase()}
        {selected ? ", SELECTED" : ""}
      </div>
      <div className="preview__line">{line}</div>
    </div>
  );
}
