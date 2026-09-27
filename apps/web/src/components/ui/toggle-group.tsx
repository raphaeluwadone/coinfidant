import { cva, type VariantProps } from "class-variance-authority";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import { type ComponentProps, createContext, useContext } from "react";
import { cn } from "@/lib/utils";

/**
 * One control for every "pick one" in the app: `segmented` is the pill switcher (theme, leftovers, sass dial),
 * `chips` the wrapping tag picker (payday, creditor, leaks).
 */
const groupVariants = cva("flex", {
  variants: {
    variant: {
      segmented: "gap-1 rounded-full bg-secondary p-[3px]",
      chips: "flex-wrap gap-2",
    },
  },
  defaultVariants: { variant: "segmented" },
});

const itemVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full border-0 font-bold whitespace-nowrap outline-none transition-[background-color,color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-default disabled:opacity-50",
  {
    variants: {
      variant: {
        segmented:
          "bg-transparent px-3 py-1.5 text-xs text-soft data-[state=on]:bg-card data-[state=on]:text-accent-foreground data-[state=on]:shadow-sm",
        chips:
          "shrink-0 bg-secondary px-3.5 py-[9px] text-[13px] font-semibold text-soft data-[state=on]:bg-primary data-[state=on]:font-bold data-[state=on]:text-primary-foreground",
      },
    },
    defaultVariants: { variant: "segmented" },
  },
);

type Variant = VariantProps<typeof groupVariants>["variant"];
const VariantContext = createContext<Variant>("segmented");

export function ToggleGroup({
  className,
  variant,
  ...props
}: ComponentProps<typeof ToggleGroupPrimitive.Root> & VariantProps<typeof groupVariants>) {
  return (
    <VariantContext.Provider value={variant}>
      <ToggleGroupPrimitive.Root
        data-slot="toggle-group"
        className={cn(groupVariants({ variant }), className)}
        {...props}
      />
    </VariantContext.Provider>
  );
}

export function ToggleGroupItem({ className, ...props }: ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  const variant = useContext(VariantContext);
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(itemVariants({ variant }), className)}
      {...props}
    />
  );
}
