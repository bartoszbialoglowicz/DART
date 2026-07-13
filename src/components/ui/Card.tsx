import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "./cn";

type CardVariant = "base" | "inset";
type CardPadding = "none" | "sm" | "md";

const VARIANT: Record<CardVariant, string> = {
  // Elevated surface — the default panel (sits on the app background)
  base: "rounded-2xl bg-surface-overlay border border-border-subtle",
  // Nested surface — for cards-within-cards (one step lighter)
  inset: "rounded-xl bg-surface-muted border border-border-subtle",
};

const PADDING: Record<CardPadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-5",
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /** Internal padding. Use "none" when the card owns its own layout. */
  padding?: CardPadding;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = "base", padding = "md", className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(VARIANT[variant], PADDING[padding], className)}
      {...rest}
    />
  );
});

export default Card;
