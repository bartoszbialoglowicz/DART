import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * Neutral outlined pill for metadata (e.g. "8 graczy", a format string).
 * Distinct from <Badge>, which carries status/score meaning (accent/up/down/rank).
 * For coloured status labels use <Badge>; for plain descriptive chips use <Tag>.
 */
export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border-subtle px-2.5 py-0.5 text-xs text-content-secondary",
        className,
      )}
    >
      {children}
    </span>
  );
}

export default Tag;
