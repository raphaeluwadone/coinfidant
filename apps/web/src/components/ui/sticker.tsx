import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** The tilted tags on cards and charts ("all yours", "you are here", "Halfway hero", "ouch"). Decorative. */
const stickerVariants = cva(
  "inline-flex w-max items-center gap-1 rounded-full border-2 px-2.5 py-0.5 font-heading text-xs leading-snug font-bold whitespace-nowrap select-none",
  {
    variants: {
      variant: {
        // On an accent-filled surface: ink outline, no fill.
        ink: "border-[var(--accent-ink)] bg-transparent text-[var(--accent-ink)]",
        accent: "border-background bg-primary text-primary-foreground",
        danger: "border-background bg-destructive text-white",
      },
      tilt: { left: "-rotate-3", right: "rotate-3", none: "" },
    },
    defaultVariants: { variant: "accent", tilt: "left" },
  },
);

export function Sticker({
  className,
  variant,
  tilt,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof stickerVariants>) {
  return <span data-slot="sticker" className={cn(stickerVariants({ variant, tilt }), className)} {...props} />;
}
