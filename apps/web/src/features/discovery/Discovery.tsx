import { formatMoney } from "@coinfidant/engine";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { paydayDue, todayQuery } from "../../lib/today";
import type { Learned } from "../../lib/transactions";
import "../payday/Flow.css";

export const learnedQueryKey = ["discovery-learned"] as const;

export function DiscoveryIntro() {
  const navigate = useNavigate();
  return (
    <main className="flow flow--center">
      <div className="flow__emoji is-floating" aria-hidden="true">
        🔍
      </div>
      <h1 className="flow__title">Discovery cycle: on</h1>
      <p className="flow__lead">
        No stress. We'll figure out your real numbers together this month. Just log everything as it happens.
      </p>
      <section className="flow__card">
        <h2>While we learn:</h2>
        <ul>
          <li>We'll use a safe placeholder budget</li>
          <li>Every log teaches us your real pattern</li>
          <li>No judgment, no streak pressure</li>
        </ul>
      </section>
      <div className="flow__spacer" />
      <button className="btn flow__cta" onClick={() => navigate({ to: "/" })} autoFocus>
        Start logging
      </button>
    </main>
  );
}

export function DiscoveryProgress() {
  const navigate = useNavigate();
  const { data } = useQuery(todayQuery);
  const p = data?.discovery;

  useEffect(() => {
    if (data && !data.discovery) navigate({ to: "/" });
  }, [data, navigate]);
  if (!data || !p) return <main className="flow" aria-busy="true" />;

  const category = (id: string) => data.categories.find((c) => c.id === id);
  return (
    <main className="flow">
      <span className="flow__badge">
        🔍 Discovery cycle · Day {p.day} of {p.days}
      </span>
      <h1 className="flow__title" style={{ textAlign: "center", marginBottom: 16 }}>
        We're learning you
      </h1>
      <section className="confidence">
        <div className="confidence__label">Confidence in your numbers</div>
        <div
          className="confidence__bar"
          role="progressbar"
          aria-valuenow={p.confidence}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="confidence__fill" style={{ width: `${p.confidence}%` }} />
        </div>
        <div className="confidence__value">{p.confidence}%</div>
      </section>
      <h2 className="flow__h2">What we know so far</h2>
      {p.categories.length === 0 ? (
        <p className="flow__note">Nothing yet. Log your first spend and we'll start learning.</p>
      ) : (
        <ul className="learned">
          {p.categories.map((c) => {
            const cat = category(c.categoryId);
            return (
              <li key={c.categoryId} className={c.monthly === null ? "is-learning" : ""}>
                <span>
                  {cat?.emoji ?? "✨"} {cat?.name ?? "Other"}
                </span>
                <strong>
                  {c.monthly === null ? "Still learning…" : `~${formatMoney(c.monthly, data.currency)}/mo`}
                </strong>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flow__spacer" />
      <button className="btn flow__cta flow__cta--quiet" onClick={() => navigate({ to: "/" })}>
        Keep logging
      </button>
    </main>
  );
}

export function DiscoveryComplete() {
  const navigate = useNavigate();
  const { data: learned } = useQuery<Learned | null>({
    queryKey: learnedQueryKey,
    queryFn: () => null,
    staleTime: Infinity,
  });
  const { data } = useQuery(todayQuery);

  useEffect(() => {
    if (learned === null) navigate({ to: "/" });
  }, [learned, navigate]);
  if (!learned || !data) return <main className="flow" aria-busy="true" />;

  return (
    <main className="flow flow--center">
      <div className="flow__emoji is-pop" aria-hidden="true">
        ✨
      </div>
      <h1 className="flow__title">We know your real numbers now</h1>
      <section className="flow__card">
        {learned.categories.length ? (
          <ul className="learned learned--final">
            {learned.categories.map((c) => (
              <li key={c.categoryId}>
                <span>
                  {c.emoji} {c.name}
                </span>
                <strong>{formatMoney(c.monthly, data.currency)}/mo</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flow__note">Nothing was logged this cycle, so we'll keep your plan as it is.</p>
        )}
      </section>
      <p className="flow__note">Your plan runs on real numbers now. No more guessing.</p>
      <div className="flow__spacer" />
      <button className="btn flow__cta" onClick={() => navigate({ to: paydayDue(data) ? "/payday" : "/" })}>
        See my real plan
      </button>
    </main>
  );
}
