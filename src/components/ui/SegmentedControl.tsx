import { cn } from "./cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<SegmentedOption<T>>;
  /** Stretch to fill the container with equal-width segments (e.g. modal tabs). */
  fullWidth?: boolean;
  "aria-label"?: string;
  className?: string;
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  fullWidth,
  className,
  ...rest
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={rest["aria-label"]}
      className={cn(
        "inline-flex gap-0.5 rounded-lg border border-border-subtle bg-surface-base p-1",
        fullWidth && "flex w-full",
        className,
      )}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-content-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base",
              fullWidth && "flex-1",
              selected
                ? "bg-surface-muted text-content-primary shadow-sm"
                : "text-content-secondary hover:text-content-primary",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
