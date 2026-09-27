import { Link, Outlet } from "@tanstack/react-router";
import { House, type LucideIcon, MessageCircle, Plus, ReceiptText, Settings, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BadgeWatcher } from "./BadgeWatcher";
import { Mascot } from "./Mascot";

type Nav = {
  to: "/" | "/transactions" | "/goals" | "/growth" | "/coach" | "/settings";
  label: string;
  icon: LucideIcon;
};

const NAV: Nav[] = [
  { to: "/", label: "Today", icon: House },
  { to: "/transactions", label: "Transactions", icon: ReceiptText },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/growth", label: "Growth", icon: TrendingUp },
  { to: "/coach", label: "Coach", icon: MessageCircle },
];
// The phone bar has room for four plus the log button; Goals stays in the sidebar until it's built.
const TABS: Nav[] = [NAV[0]!, NAV[1]!, NAV[3]!, NAV[4]!];

export function AppShell() {
  return (
    <div className="min-h-dvh min-[900px]:grid min-[900px]:grid-cols-[280px_1fr]">
      <BadgeWatcher />
      <aside className="sticky top-0 hidden h-dvh flex-col gap-7 border-r border-border bg-background px-4 py-6 min-[900px]:flex">
        <Link to="/" className="flex items-center gap-2.5 px-2 text-foreground no-underline">
          <Mascot size={34} />
          <span className="font-heading text-xl font-bold tracking-tight">coinfidant</span>
        </Link>
        <Button asChild className="h-14 w-full text-base">
          <Link to="/log">
            <Plus className="size-5" strokeWidth={2.5} aria-hidden="true" />
            Log a spend
          </Link>
        </Button>
        <nav className="grid gap-1" aria-label="Main">
          {NAV.map((n) => (
            <SideLink key={n.to} {...n} />
          ))}
        </nav>
        <nav className="mt-auto grid" aria-label="Account">
          <SideLink to="/settings" label="Settings" icon={Settings} />
        </nav>
      </aside>

      <main className="relative min-h-dvh px-5 pt-6 pb-[calc(120px+env(safe-area-inset-bottom,0px))] min-[900px]:px-10 min-[900px]:py-9">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-around border-t border-border bg-card px-3 pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom,0px))] min-[900px]:hidden"
        aria-label="Main"
      >
        {TABS.slice(0, 2).map((n) => (
          <TabLink key={n.to} {...n} />
        ))}
        <Link
          to="/log"
          aria-label="Log a spend"
          className="-mt-8 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-[var(--fab-shadow)] transition-colors hover:bg-primary-hover"
        >
          <Plus className="size-7" strokeWidth={2.5} aria-hidden="true" />
        </Link>
        {TABS.slice(2).map((n) => (
          <TabLink key={n.to} {...n} />
        ))}
      </nav>
    </div>
  );
}

function SideLink({ to, label, icon: Icon }: Nav) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/" }}
      className="group relative flex items-center gap-3 rounded-field px-3 py-2.5 text-[15px] font-semibold text-soft no-underline transition-colors hover:bg-secondary data-[status=active]:bg-secondary data-[status=active]:text-foreground"
    >
      <span
        aria-hidden="true"
        className="absolute top-2 bottom-2 -left-4 w-1 rounded-r-full bg-primary opacity-0 group-data-[status=active]:opacity-100"
      />
      <Icon className="size-5 text-muted-foreground group-data-[status=active]:text-foreground" aria-hidden="true" />
      {label}
    </Link>
  );
}

function TabLink({ to, label, icon: Icon }: Nav) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/" }}
      className={cn(
        "flex min-w-14 flex-col items-center gap-1 text-[11px] font-semibold text-muted-foreground no-underline",
        "data-[status=active]:font-bold data-[status=active]:text-accent-foreground",
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
      {label}
    </Link>
  );
}
