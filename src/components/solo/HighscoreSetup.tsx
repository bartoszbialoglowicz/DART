import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { HighscoreSession } from '../../types/player';

const MIN_DARTS = 9;
const MAX_DARTS = 50;

function clampDartCount(value: number): number {
  if (!Number.isFinite(value)) return MIN_DARTS;
  return Math.min(MAX_DARTS, Math.max(MIN_DARTS, Math.round(value)));
}

type Props = {
  sessions: HighscoreSession[];
  onStart:  (dartsTarget: number) => void;
  onBack:   () => void;
};

export function HighscoreSetup({ sessions, onStart, onBack }: Props) {
  const [dartsInput, setDartsInput] = useState(String(MIN_DARTS + 6)); // 15

  function normalize() {
    setDartsInput(String(clampDartCount(Number(dartsInput))));
  }

  const dartsTarget = clampDartCount(Number(dartsInput));
  const best = sessions
    .filter(s => s.darts === dartsTarget)
    .reduce<number | null>((max, s) => (max === null || s.score > max ? s.score : max), null);

  return (
    <div className="mx-auto w-full max-w-sm px-6 py-8">
      <Button variant="ghost" size="md" onClick={onBack} className="mb-6">
        ← Wróć
      </Button>

      <h2 className="mb-2 text-lg font-semibold text-content-primary">Highscore</h2>
      <p className="mb-8 text-xs text-content-secondary leading-relaxed">
        Zdobądź jak największy łączny wynik z wybranej liczby lotek — bez schodzenia w dół.
      </p>

      <section className="mb-8">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-content-secondary">
          Liczba lotek
        </p>
        <Input
          type="number"
          min={MIN_DARTS}
          max={MAX_DARTS}
          value={dartsInput}
          onChange={e => setDartsInput(e.target.value)}
          onBlur={normalize}
          className="max-w-32"
        />
        <p className="mt-1.5 text-xs text-content-faint">
          Od {MIN_DARTS} do {MAX_DARTS} lotek.
        </p>
        {best !== null && (
          <p className="mt-3 text-xs text-content-secondary">
            Twój rekord dla {dartsTarget} lotek: <span className="font-semibold text-content-primary">{best}</span>
          </p>
        )}
      </section>

      <Button variant="primary" size="lg" fullWidth onClick={() => onStart(dartsTarget)}>
        Zagraj
      </Button>
    </div>
  );
}
