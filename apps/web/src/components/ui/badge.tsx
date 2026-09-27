import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Pills and tags: tone and phase pills, "🔥 Boss fight", "DEFEATED". */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-[7px] text-xs leading-none font-bold whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-secondary text-accent-foreground",
        accent: "bg-accent text-accent-foreground",
        success: "bg-success/15 text-success",
        warn: "bg-warn/15 text-warn",
        plain: "bg-transparent px-0 py-0 text-accent-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({ className, variant, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
