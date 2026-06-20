import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";

type Tone = "accent" | "danger";
type Layout = "row" | "stack";

const SELECTED: Record<Tone, string> = {
  accent: "border-border-accent bg-accent-soft",
  danger: "border-score-down bg-score-down-soft",
};

const UNSELECTED = "border-border-subtle bg-surface-overlay hover:bg-surface-muted";

const LAYOUT: Record<Layout, string> = {
  row: "flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-left",
  stack: "flex h-full flex-col gap-4 rounded-xl px-5 py-5 text-left",
};

export interface SelectableCardProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> {
  selected?: boolean;
  tone?: Tone;
  layout?: Layout;
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Trailing text in row layout (e.g. "σ = 4 mm"). */
  meta?: ReactNode;
  /** Bottom slot in stack layout (e.g. a <Badge>). */
  footer?: ReactNode;
}

export const SelectableCard = forwardRef<HTMLButtonElement, SelectableCardProps>(
  function SelectableCard(
    {
      selected = false,
      tone = "accent",
      layout = "row",
      icon,
      title,
      description,
      meta,
      footer,
      className,
      type = "button",
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        aria-pressed={selected}
        className={cn(
          "border transition",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-content-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base",
          "disabled:pointer-events-none disabled:opacity-40",
          LAYOUT[layout],
          selected ? SELECTED[tone] : UNSELECTED,
          className,
        )}
        {...rest}
      >
        {layout === "row" ? (
          <>
            <div className="flex min-w-0 items-center gap-3">
              {icon && <span className="shrink-0 text-content-accent">{icon}</span>}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-content-primary">{title}</p>
                {description && (
                  <p className="mt-0.5 text-xs text-content-secondary">{description}</p>
                )}
              </div>
            </div>
            {meta && <span className="shrink-0 text-xs text-content-secondary">{meta}</span>}
          </>
        ) : (
          <>
            {icon && <span className="text-content-accent">{icon}</span>}
            <div>
              <p className="text-sm font-semibold text-content-primary">{title}</p>
              {description && (
                <p className="mt-1 text-xs text-content-secondary">{description}</p>
              )}
            </div>
            {footer && <div className="mt-auto">{footer}</div>}
          </>
        )}
      </button>
    );
  },
);

export default SelectableCard;
