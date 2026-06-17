import type { ReactNode } from "react";
import { cn } from "./cn";

type BadgeVariant = "accent" | "neutral" | "up" | "down" | "rank";

const VARIANT: Record<BadgeVariant, string> = {
  accent: "bg-accent-soft text-accent-text",
  neutral: "border-border-subtle text-content-secondary",
  up: "bg-score-up-soft text-score-up-text",
  down: "bg-score-down-soft text-score-down-text",
  rank: "bg-rank-soft text-rank-text uppercase tracking-wider",
};

export interface BadgeProps {
  variant?: BadgeVariant;
  /** Render children in the throw-notation monospace face (e.g. "180"). */
  mono?: boolean;
  children: ReactNode;
  className?: string;
}

export function Badge({
  variant = "neutral",
  mono,
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-transparent px-2.5 py-0.5 text-xs font-semibold leading-tight",
        VARIANT[variant],
        mono && "font-mono",
        className,
      )}
    >
      {children}
    </span>
  );
}

export default Badge;
