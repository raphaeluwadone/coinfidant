import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The screen title block from the redesign: small label, big display title, one line under it. */
export function PageHeader({
  eyebrow,
  title,
  sub,
  aside,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  sub?: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-8 gap-y-4", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="m-0 text-[15px] text-muted-foreground">{eyebrow}</p>}
        <h1 className="m-0 mt-1 font-heading text-[clamp(32px,5vw,48px)] leading-[1.05] font-extrabold tracking-[-0.03em]">
          {title}
        </h1>
        {sub && <p className="m-0 mt-2 text-base text-soft">{sub}</p>}
      </div>
      {aside}
    </header>
  );
}
