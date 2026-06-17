import { cn } from "./cn";

export type Result = "W" | "L";

const VARIANT: Record<Result, string> = {
  W: "bg-score-up-soft text-score-up-text",
  L: "bg-score-down-soft text-score-down-text",
};

const LABEL: Record<Result, string> = { W: "Wygrana", L: "Przegrana" };

export interface ResultChipProps {
  result: Result;
  className?: string;
}

export function ResultChip({ result, className }: ResultChipProps) {
  return (
    <span
      role="img"
      aria-label={LABEL[result]}
      className={cn(
        "inline-grid h-8 w-8 place-items-center rounded-md font-mono text-sm font-bold",
        VARIANT[result],
        className,
      )}
    >
      {result}
    </span>
  );
}

export default ResultChip;
