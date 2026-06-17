import type { ReactNode } from "react";
import { cn } from "./cn";

type StatSize = "sm" | "md" | "lg";

const NUM_SIZE: Record<StatSize, string> = {
  sm: "text-2xl",
  md: "text-4xl",
  lg: "text-5xl",
};

const UNIT_SIZE: Record<StatSize, string> = {
  sm: "text-sm",
  md: "text-lg",
  lg: "text-xl",
};

export interface StatProps {
  /** The headline figure. Format it however you like (string or number). */
  value: ReactNode;
  /** Small uppercase eyebrow above the value. */
  label?: ReactNode;
  /** Trailing unit shown muted and smaller, e.g. "%". */
  unit?: string;
  size?: StatSize;
  /**
   * Signed change. Sign drives the colour (board green up / double red down)
   * and the ▲/▼ marker. Pass `deltaText` to control the displayed string,
   * e.g. delta={1.18} deltaText="+1.18 (+1.2%)".
   */
  delta?: number;
  deltaText?: ReactNode;
  /** Inline slot beside the value — typically a <Badge> like "Rekord". */
  badge?: ReactNode;
  /** Muted line under the value, e.g. a date. */
  caption?: ReactNode;
  className?: string;
}

function defaultDeltaText(delta: number): string {
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(2)}`;
}

export function Stat({
  value,
  label,
  unit,
  size = "md",
  delta,
  deltaText,
  badge,
  caption,
  className,
}: StatProps) {
  const hasDelta = delta !== undefined;
  const up = hasDelta && (delta as number) >= 0;

  return (
    <div className={className}>
      {label && (
        // Inline eyebrow — will delegate to <Eyebrow> once that primitive lands.
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-content-secondary">
          {label}
        </p>
      )}

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className={cn(
            "font-display font-extrabold tabular-nums leading-none tracking-tight text-content-primary",
            NUM_SIZE[size],
          )}
        >
          {value}
          {unit && (
            <span className={cn("ml-0.5 text-content-secondary", UNIT_SIZE[size])}>
              {unit}
            </span>
          )}
        </span>

        {hasDelta && (
          <span
            className={cn(
              "text-sm font-semibold tabular-nums",
              up ? "text-score-up-text" : "text-score-down-text",
            )}
          >
            <span aria-hidden="true">{up ? "\u25B2" : "\u25BC"}</span>{" "}
            {deltaText ?? defaultDeltaText(delta as number)}
          </span>
        )}

        {badge}
      </div>

      {caption && (
        <p className="mt-1.5 text-xs text-content-secondary">{caption}</p>
      )}
    </div>
  );
}

export default Stat;
