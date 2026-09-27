import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="grid gap-2.5">
      <h2 className="m-0 text-sm font-bold">{title}</h2>
      {hint && <p className="m-0 -mt-1 mb-1 text-[13px] font-semibold text-muted-foreground">{hint}</p>}
      {children}
    </section>
  );
}

const ROW =
  "flex w-full items-center justify-between gap-3 rounded-tile border-0 bg-card px-4 py-3.5 text-left text-sm font-semibold text-card-foreground shadow-tile";

type RowProps = { title: ReactNode; hint?: string; children?: ReactNode; className?: string };

/** A settings line: title (and optional hint) on the left, its control on the right. */
export function Row({ title, hint, children, className }: RowProps) {
  return (
    <div className={cn(ROW, className)}>
      <RowText title={title} hint={hint} />
      {children}
    </div>
  );
}

/** A whole row that acts as one button. */
export function RowButton({
  title,
  hint,
  children,
  className,
  disabled,
  onClick,
}: RowProps & { disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(ROW, "cursor-pointer transition-colors hover:bg-secondary disabled:cursor-default", className)}
    >
      <RowText title={title} hint={hint} />
      {children}
    </button>
  );
}

function RowText({ title, hint }: Pick<RowProps, "title" | "hint">) {
  return (
    <span className="min-w-0">
      {title}
      {hint && <small className="mt-0.5 block text-xs font-medium text-muted-foreground">{hint}</small>}
    </span>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 text-[13px] font-semibold text-destructive" role="alert">
      {children}
    </p>
  );
}
