import { useState, type ReactNode } from 'react';
import { Button } from '../ui/Button';
import { StepIndicator } from '../ui/StepIndicator';

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
      <StepIndicator steps={steps} current={current} onStepClick={setCurrent} />

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
