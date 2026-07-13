import { useState } from 'react';
import { useApprovePendingResult, useDismissPendingResult } from '../../hooks/usePendingResults';
import type { PendingMatchResult } from '../../types/player';
import { fmtDate } from '../../utils/formatting';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export function PendingResultsModal({ pending }: { pending: PendingMatchResult[] }) {
  const [idx, setIdx]    = useState(0);
  const approve          = useApprovePendingResult();
  const dismiss          = useDismissPendingResult();

  if (pending.length === 0 || idx >= pending.length) return null;

  const result   = pending[idx];
  const total    = result.legs_won + result.legs_lost;
  const won      = result.legs_won > result.legs_lost;
  const drawn    = result.legs_won === result.legs_lost;
  const resultLabel = won ? 'Wygrałeś' : drawn ? 'Remis' : 'Przegrałeś';

  function next() {
    setIdx(i => i + 1);
    approve.reset();
    dismiss.reset();
  }

  function handleApprove() {
    approve.mutate(result.id, { onSuccess: next });
  }

  function handleDismiss() {
    dismiss.mutate(result.id, { onSuccess: next });
  }

  return (
    <Modal
      title="Mecz oczekuje na zatwierdzenie"
      size="sm"
      onClose={handleDismiss}
    >
      <div className="flex flex-col gap-4">
        {pending.length > 1 && (
          <p className="text-xs text-content-faint">
            {idx + 1} / {pending.length}
          </p>
        )}

        <div className="rounded-xl border border-border-subtle bg-surface-muted px-4 py-4">
          <p className="mb-0.5 text-xs text-content-secondary">{fmtDate(result.played_at)}</p>
          <p className="text-sm text-content-primary">
            Rozegrano mecz z{' '}
            <span className="font-semibold text-content-accent">{result.opponent_name}</span>
            {' '}na innym urządzeniu.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface-overlay px-4 py-3">
          <div>
            <p className="text-xs text-content-secondary">Wynik</p>
            <p className={[
              'font-display text-2xl font-bold tabular-nums',
              won ? 'text-score-up-text' : drawn ? 'text-content-primary' : 'text-score-down-text',
            ].join(' ')}>
              {result.legs_won}:{result.legs_lost}
            </p>
            <p className="text-xs text-content-secondary">{resultLabel} · {total} {total === 1 ? 'leg' : 'legi'}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-content-secondary">Twoja średnia</p>
            <p className="font-display text-2xl font-bold tabular-nums text-content-primary">
              {result.average.toFixed(1)}
            </p>
          </div>
        </div>

        <p className="text-sm text-content-secondary">
          Czy wprowadzić ten mecz do Twoich statystyk?
        </p>

        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            loading={dismiss.isPending}
            onClick={handleDismiss}
          >
            Pomiń
          </Button>
          <Button
            variant="primary"
            loading={approve.isPending}
            onClick={handleApprove}
          >
            Tak, zapisz
          </Button>
        </div>
      </div>
    </Modal>
  );
}
