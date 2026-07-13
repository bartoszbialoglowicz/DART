import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export interface ToggleProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "type"> {
  checked: boolean;
  onChange: (value: boolean) => void;
}

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(function Toggle(
  { checked, onChange, disabled, className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-content-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base",
        "disabled:pointer-events-none disabled:opacity-50",
        checked
          ? "border-transparent bg-surface-accent"
          : "border-border-subtle bg-surface-muted",
        className,
      )}
      {...rest}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 rounded-full bg-surface-invert shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
});

export default Toggle;
