import type { Minor } from "@coinfidant/engine";

const fmt = new Intl.NumberFormat("en-NG");

/** Whole-unit amount entry. Value is in minor units. */
export function MoneyInput({
  value,
  onChange,
  currency = "NGN",
  className = "",
  ...rest
}: {
  value: Minor;
  onChange: (v: Minor) => void;
  currency?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <div className={`money-input ${className}`}>
      <span>{currency}</span>
      <input
        {...rest}
        inputMode="numeric"
        value={value ? fmt.format(value / 100) : ""}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
          onChange(digits ? Number(digits) * 100 : 0);
        }}
      />
    </div>
  );
}
