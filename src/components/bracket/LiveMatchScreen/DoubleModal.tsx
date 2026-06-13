import { useState } from 'react';
import type { DoubleModalPending } from './useMatchEngine';

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

  const btnBase   = 'h-12 w-12 rounded-xl text-sm font-bold transition-colors';
  const btnActive = (selected: boolean) =>
    selected ? 'bg-brand-purple text-brand-white' : 'bg-white/8 text-content-secondary hover:bg-white/12';

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-brand-black/97 px-8 gap-6">
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-widest text-content-secondary">
          {playerName} · pozostało {state.remainingBefore}
        </p>
        <p className="mt-1 text-2xl font-black text-brand-white">
          {state.isClosing ? 'Zamknięcie lega!' : 'Podejście do doubla'}
        </p>
      </div>

      <div className="w-full max-w-xs flex flex-col gap-5">
        {/* Darts aimed at double */}
        <div>
          <p className="mb-2 text-xs text-content-secondary text-center">
            Ile lotek celowałeś w <span className="text-brand-white font-semibold">double</span>?
          </p>
          <div className="flex justify-center gap-3">
            {[0, 1, 2, 3].map(n => (
              <button
                key={n}
                type="button"
                onPointerDown={(e) => { e.preventDefault(); setDartsAtDouble(n); }}
                className={`${btnBase} ${btnActive(dartsAtDouble === n)}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Darts to close — only when this visit closed the leg */}
        {state.isClosing && (
          <div>
            <p className="mb-2 text-xs text-content-secondary text-center">
              Ile lotek zajęło <span className="text-brand-white font-semibold">zamknięcie</span>?
            </p>
            <div className="flex justify-center gap-3">
              {[1, 2, 3].map(n => {
                const invalid = dartsAtDouble !== null && n > dartsAtDouble;
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={invalid}
                    onPointerDown={(e) => { e.preventDefault(); if (!invalid) setDartsToClose(n); }}
                    className={`${btnBase} ${btnActive(dartsToClose === n)} disabled:opacity-25`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex w-full max-w-xs gap-3">
        <button
          type="button"
          onPointerDown={(e) => { e.preventDefault(); onSkip(); }}
          className="flex-1 rounded-xl border border-border-subtle py-3 text-sm text-content-secondary hover:text-brand-white transition-colors"
        >
          Pomiń
        </button>
        <button
          type="button"
          disabled={!canConfirm}
          onPointerDown={(e) => { e.preventDefault(); handleConfirm(); }}
          className="flex-1 rounded-xl bg-brand-purple/80 py-3 text-sm font-semibold text-brand-white hover:bg-brand-purple disabled:opacity-30 transition-colors"
        >
          Zatwierdź
        </button>
      </div>
    </div>
  );
}
