import { useState, type ReactNode } from 'react';
import { Button } from '../ui/Button';
import { cn } from '../ui/cn';

export type SetupStep = {
  label:   string;
  done:    boolean;
  content: ReactNode;
};

type Props = {
  steps:          SetupStep[];
  /** Step index to land on first (e.g. the first incomplete one). */
  initialStep?:   number;
  /** Gate for the finalize action on the last step. */
  canFinalize:    boolean;
  finalizing:     boolean;
  onFinalize:     () => void;
  finalizeLabel?: string;
};

export function LeagueSetupStepper({
  steps, initialStep = 0, canFinalize, finalizing, onFinalize, finalizeLabel = 'Zakończ kreator',
}: Props) {
  const [current, setCurrent] = useState(
    Math.min(Math.max(initialStep, 0), steps.length - 1),
  );
  const isLast = current === steps.length - 1;

  return (
    <div className="flex flex-col gap-6">

      {/* Step header */}
      <ol className="flex items-center overflow-x-auto pb-1">
        {steps.map((step, i) => {
          const state = i === current ? 'current' : step.done ? 'done' : 'upcoming';
          return (
            <li key={step.label} className={cn('flex items-center', i < steps.length - 1 && 'flex-1')}>
              <button
                type="button"
                onClick={() => setCurrent(i)}
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

      {/* Active step body */}
      <div>{steps[current].content}</div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-4">
        <Button
          variant="ghost"
          disabled={current === 0}
          onClick={() => setCurrent(c => Math.max(0, c - 1))}
        >
          Wstecz
        </Button>
        {isLast ? (
          <Button
            variant="primary"
            disabled={!canFinalize || finalizing}
            loading={finalizing}
            onClick={onFinalize}
          >
            {finalizeLabel}
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={() => setCurrent(c => Math.min(steps.length - 1, c + 1))}
          >
            Dalej
          </Button>
        )}
      </div>
    </div>
  );
}
