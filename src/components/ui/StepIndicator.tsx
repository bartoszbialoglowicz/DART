import { cn } from './cn';

export type IndicatorStep = {
  label: string;
  done: boolean;
};

type Props = {
  steps: IndicatorStep[];
  current: number;
  onStepClick?: (index: number) => void;
};

export function StepIndicator({ steps, current, onStepClick }: Props) {
  return (
    <ol className="flex items-center overflow-x-auto pb-1">
      {steps.map((step, i) => {
        const state = i === current ? 'current' : step.done ? 'done' : 'upcoming';
        return (
          <li key={step.label} className={cn('flex items-center', i < steps.length - 1 && 'flex-1')}>
            <button
              type="button"
              onClick={() => onStepClick?.(i)}
              aria-current={state === 'current' ? 'step' : undefined}
              className="flex items-center gap-2 whitespace-nowrap rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-content-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
            >
              <span className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums transition',
                state === 'done'     && 'bg-content-accent text-content-on-accent',
                state === 'current'  && 'border-2 border-content-accent text-content-accent',
                state === 'upcoming' && 'border border-border-subtle text-content-faint',
              )}>
                {state === 'done' ? '✓' : i + 1}
              </span>
              <span className={cn(
                'text-sm font-medium transition',
                state === 'upcoming' ? 'text-content-faint' : 'text-content-primary',
              )}>
                {step.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <span className="mx-3 h-px flex-1 bg-border-subtle" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
