import type { Minor } from "@coinfidant/engine";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const fmt = new Intl.NumberFormat("en-NG");

/** Whole-unit amount entry. Value is in minor units. Styled to match the shared Input. */
export function MoneyInput({
  value,
  onChange,
  currency = "NGN",
  className,
  ...rest
}: {
  value: Minor;
  onChange: (v: Minor) => void;
  currency?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <div
      className={cn(
        "money-input flex h-12 min-w-0 items-center gap-2 rounded-field border border-input bg-secondary px-3.5 transition-colors focus-within:border-ring",
        className,
      )}
    >
      <span className="text-[13px] font-bold text-muted-foreground">{currency}</span>
      <input
        {...rest}
        inputMode="numeric"
        className="min-w-0 flex-1 border-0 bg-transparent text-base font-bold text-foreground outline-none placeholder:font-semibold placeholder:text-muted-foreground"
        value={value ? fmt.format(value / 100) : ""}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
          onChange(digits ? Number(digits) * 100 : 0);
        }}
      />
    </div>
  );
}
