import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Input } from '../ui/Input';
import { OptionButton } from '../ui/OptionButton';
import { cn } from '../ui/cn';
import { buildRoundDates, type RoundDate } from '../../utils/scheduleDates';

export type RoundInfo = { round: number; label: string };

const PRESETS = [
  { label: 'Co tydzień',    days: 7  },
  { label: 'Co 2 tygodnie', days: 14 },
];

function fmtShort(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

type Props = {
  /** Round whose date was just set — the pivot for everything else. */
  anchorRound:      number;
  /** Date set on the anchor, 'YYYY-MM-DD'. */
  anchorDate:       string;
  /** Every round in the schedule, in order. */
  rounds:           RoundInfo[];
  /** Apply the pre-filled dates (caller writes them to matches; not locked). */
  onConfirm:        (dates: RoundDate[]) => void;
  onClose:          () => void;
  defaultInterval?: number;
};

export function ScheduleAutofillModal({
  anchorRound, anchorDate, rounds, onConfirm, onClose, defaultInterval = 7,
}: Props) {
  const [intervalDays, setIntervalDays] = useState(defaultInterval);
  const safeInterval = Number.isFinite(intervalDays) && intervalDays > 0 ? Math.floor(intervalDays) : 1;

  const preview     = buildRoundDates(rounds.map(r => r.round), anchorRound, anchorDate, safeInterval);
  const dateByRound = new Map(preview.map(p => [p.round, p.date]));

  return (
    <Modal title="Rozstaw daty kolejek" onClose={onClose} size="sm">
      <p className="text-sm text-content-secondary">
        Ustaw daty pozostałych kolejek automatycznie, licząc od ustawionej już daty.
        Wartości są wstępne — możesz je dalej edytować.
      </p>

      {/* Interval picker */}
      <div className="mt-4 flex flex-wrap items-end gap-2">
        {PRESETS.map(p => (
          <OptionButton
            key={p.days}
            selected={safeInterval === p.days}
            onClick={() => setIntervalDays(p.days)}
          >
            {p.label}
          </OptionButton>
        ))}
        <Field label="Inny odstęp (dni)" className="w-32">
          <Input
            type="number"
            min={1}
            value={Number.isNaN(intervalDays) ? '' : intervalDays}
            onChange={e => setIntervalDays(e.target.valueAsNumber)}
          />
        </Field>
      </div>

      {/* Live preview */}
      <div className="mt-5">
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-content-secondary">Podgląd</p>
        <ul className="max-h-56 overflow-y-auto rounded-lg border border-border-subtle">
          {rounds.map((r, i) => {
            const isAnchor = r.round === anchorRound;
            return (
              <li
                key={r.round}
                className={cn(
                  'flex items-center justify-between gap-3 px-3 py-2 text-sm',
                  i > 0 && 'border-t border-border-subtle',
                  isAnchor && 'bg-accent-soft',
                )}
              >
                <span className={isAnchor ? 'text-content-accent' : 'text-content-secondary'}>
                  {r.label}
                  {isAnchor && <span className="ml-2 text-xs text-content-faint">ustawiona</span>}
                </span>
                <span className={cn(
                  'font-display tabular-nums',
                  isAnchor ? 'text-content-accent' : 'text-content-primary',
                )}>
                  {fmtShort(dateByRound.get(r.round) ?? anchorDate)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Actions */}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Nie teraz</Button>
        <Button variant="primary" onClick={() => onConfirm(preview)}>Rozstaw daty</Button>
      </div>
    </Modal>
  );
}
