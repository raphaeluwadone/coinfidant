import { Link, Outlet } from "@tanstack/react-router";
import { Mascot } from "./Mascot";
import "./AppShell.css";

const NAV = [
  { to: "/", label: "Today", emoji: "🏠" },
  { to: "/goals", label: "Goals", emoji: "🎯" },
  { to: "/growth", label: "Growth", emoji: "📈" },
  { to: "/coach", label: "Coach", emoji: "🤝" },
] as const;

export function AppShell() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <Mascot size={34} />
          <span>Coinfidant</span>
        </div>
        <nav className="sidebar__nav">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className="sidebar__link" activeOptions={{ exact: true }}>
              <span aria-hidden="true">{n.emoji}</span>
              {n.label}
            </Link>
          ))}
        </nav>
        <Link to="/log" className="sidebar__log">
          + Log spend
        </Link>
      </aside>

      <div className="shell__main">
        <div className="shell__blob shell__blob--a" aria-hidden="true" />
        <div className="shell__blob shell__blob--b" aria-hidden="true" />
        <Outlet />
      </div>

      <nav className="tabbar" aria-label="Main">
        {NAV.slice(0, 2).map((n, i) => (
          <TabLink key={n.to} {...n} delay={i * 0.3} />
        ))}
        <Link to="/log" className="tabbar__fab" aria-label="Log a spend">
          +
        </Link>
        {NAV.slice(2).map((n, i) => (
          <TabLink key={n.to} {...n} delay={(i + 2) * 0.3} />
        ))}
      </nav>
    </div>
  );
}

function TabLink({ to, label, emoji, delay }: { to: string; label: string; emoji: string; delay: number }) {
  return (
    <Link to={to} className="tabbar__link" activeOptions={{ exact: true }}>
      <span className="tabbar__emoji" style={{ animationDelay: `${delay}s` }} aria-hidden="true">
        {emoji}
      </span>
      {label}
    </Link>
  );
}
