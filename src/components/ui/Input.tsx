import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "./cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "w-full rounded-lg border bg-surface-muted px-3 py-2 text-sm text-content-primary",
        "placeholder:text-content-faint outline-none transition",
        "focus:border-border-accent focus:ring-2 focus:ring-content-accent",
        "disabled:pointer-events-none disabled:opacity-50",
        invalid ? "border-score-down" : "border-border-subtle",
        className,
      )}
      {...rest}
    />
  );
});

export default Input;
