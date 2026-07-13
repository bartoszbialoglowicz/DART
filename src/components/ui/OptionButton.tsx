import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

type Tone = "accent" | "danger";

const SELECTED: Record<Tone, string> = {
  accent: "border-border-accent bg-accent-soft text-content-accent",
  danger: "border-score-down bg-score-down-soft text-score-down-text",
};

const UNSELECTED =
  "border-border-subtle bg-surface-overlay text-content-secondary hover:bg-surface-muted hover:text-content-primary";

export interface OptionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  tone?: Tone;
}

export const OptionButton = forwardRef<HTMLButtonElement, OptionButtonProps>(
  function OptionButton(
    { selected = false, tone = "accent", className, type = "button", ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        aria-pressed={selected}
        className={cn(
          "inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-content-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base",
          "disabled:pointer-events-none disabled:opacity-40",
          selected ? SELECTED[tone] : UNSELECTED,
          className,
        )}
        {...rest}
      />
    );
  },
);

export default OptionButton;
