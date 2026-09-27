import { Slot as SlotPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** `asChild` lends the card look to a link or a <section>. */
export function Card({ className, asChild = false, ...props }: ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? SlotPrimitive.Slot : "div";
  return (
    <Comp
      data-slot="card"
      className={cn("block rounded-tile bg-card p-5 text-card-foreground no-underline shadow-tile", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 data-slot="card-title" className={cn("m-0 text-base font-bold", className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p data-slot="card-description" className={cn("m-0 text-sm text-muted-foreground", className)} {...props} />;
}

/** The small uppercase label above a figure ("YOU CAN SPEND TODAY"). */
export function Eyebrow({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="eyebrow"
      className={cn("text-xs font-bold tracking-[0.05em] text-muted-foreground uppercase", className)}
      {...props}
    />
  );
}
