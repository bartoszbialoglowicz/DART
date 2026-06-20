import { useState } from 'react';
import type { DoubleModalPending } from './useMatchEngine';
import { OptionButton } from '../../ui/OptionButton';
import { Button } from '../../ui/Button';

export function DoubleModal({
  state, playerName, onConfirm, onSkip,
}: {
  state:      DoubleModalPending;
  playerName: string;
  onConfirm:  (dartsAtDouble: number, dartsToClose?: number) => void;
  onSkip:     () => void;
}) {
  const [dartsAtDouble, setDartsAtDouble] = useState<number | null>(null);
  const [dartsToClose,  setDartsToClose]  = useState<number | null>(null);

  const closeValid  = !state.isClosing || dartsToClose !== null;
  const doubleValid = dartsAtDouble !== null;
  const orderValid  = !state.isClosing || dartsAtDouble === null || dartsToClose === null || dartsAtDouble >= dartsToClose;
  const canConfirm  = doubleValid && closeValid && orderValid;

  function handleConfirm() {
    if (!canConfirm || dartsAtDouble === null) return;
    onConfirm(dartsAtDouble, state.isClosing ? (dartsToClose ?? undefined) : undefined);
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-black/95 px-8">
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-widest text-content-secondary">
          {playerName} · pozostało {state.remainingBefore}
        </p>
        <p className="mt-1 font-display text-2xl font-extrabold text-content-primary">
          {state.isClosing ? 'Zamknięcie lega!' : 'Podejście do doubla'}
        </p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-5">
        {/* Darts aimed at double */}
        <div>
          <p className="mb-2 text-center text-xs text-content-secondary">
            Ile lotek celowałeś w <span className="font-semibold text-content-primary">double</span>?
          </p>
          <div className="flex justify-center gap-3">
            {[0, 1, 2, 3].map(n => (
              <OptionButton
                key={n}
                selected={dartsAtDouble === n}
                onPointerDown={(e) => { e.preventDefault(); setDartsAtDouble(n); }}
              >
                {n}
              </OptionButton>
            ))}
          </div>
        </div>

        {/* Darts to close — only when this visit closed the leg */}
        {state.isClosing && (
          <div>
            <p className="mb-2 text-center text-xs text-content-secondary">
              Ile lotek zajęło <span className="font-semibold text-content-primary">zamknięcie</span>?
            </p>
            <div className="flex justify-center gap-3">
              {[1, 2, 3].map(n => {
                const invalid = dartsAtDouble !== null && n > dartsAtDouble;
                return (
                  <OptionButton
                    key={n}
                    selected={dartsToClose === n}
                    disabled={invalid}
                    onPointerDown={(e) => { e.preventDefault(); if (!invalid) setDartsToClose(n); }}
                  >
                    {n}
                  </OptionButton>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex w-full max-w-xs gap-3">
        <Button
          variant="secondary"
          fullWidth
          onPointerDown={(e) => { e.preventDefault(); onSkip(); }}
        >
          Pomiń
        </Button>
        <Button
          variant="primary"
          fullWidth
          disabled={!canConfirm}
          onPointerDown={(e) => { e.preventDefault(); handleConfirm(); }}
        >
          Zatwierdź
        </Button>
      </div>
    </div>
  );
}
