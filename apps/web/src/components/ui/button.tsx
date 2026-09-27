import { cva, type VariantProps } from "class-variance-authority";
import { Slot as SlotPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border-0 font-bold whitespace-nowrap no-underline outline-none transition-[transform,background-color,color,filter] duration-150 focus-visible:ring-[3px] focus-visible:ring-ring/40 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary: "bg-accent text-accent-foreground hover:brightness-110",
        outline: "border border-border bg-transparent text-foreground hover:bg-secondary",
        ghost: "bg-transparent text-foreground hover:bg-secondary",
        soft: "bg-secondary text-soft hover:text-foreground",
        surface: "border border-border bg-card text-foreground hover:bg-secondary",
        destructive: "bg-destructive text-white hover:brightness-110",
        link: "bg-transparent text-accent-foreground underline-offset-4 hover:underline active:scale-100",
        muted: "bg-transparent font-semibold text-muted-foreground hover:text-foreground active:scale-100",
      },
      size: {
        default: "h-13 px-6 text-base",
        sm: "h-10 px-4 text-sm",
        icon: "size-9 text-base",
        inline: "h-auto justify-self-start p-0 text-sm",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type = "button",
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? SlotPrimitive.Slot : "button";
  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
