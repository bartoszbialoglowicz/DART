import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { OptionButton } from '../ui/OptionButton';

const MIN_DARTS = 6;
const MAX_DARTS = 180;

function clampDartLimit(value: number): number {
  if (!Number.isFinite(value)) return 30;
  return Math.min(MAX_DARTS, Math.max(MIN_DARTS, Math.round(value)));
}

const SECTORS = [...Array.from({ length: 20 }, (_, i) => String(i + 1)), 'BULL'];

type Props = {
  onStart: (sector: string, dartsLimit: number) => void;
  onBack:  () => void;
};

export function SectorPracticeSetup({ onStart, onBack }: Props) {
  const [sector,     setSector]     = useState<string>('20');
  const [dartsInput, setDartsInput] = useState(String(30));

  function normalize() {
    setDartsInput(String(clampDartLimit(Number(dartsInput))));
  }

  const dartsLimit = clampDartLimit(Number(dartsInput));

  return (
    <div className="mx-auto w-full max-w-sm px-6 py-8">
      <Button variant="ghost" size="md" onClick={onBack} className="mb-6">
        ← Wróć
      </Button>

      <h2 className="mb-2 text-lg font-semibold text-content-primary">Jeden sektor</h2>
      <p className="mb-8 text-xs text-content-secondary leading-relaxed">
        Celuj cały czas w jeden sektor. Po każdym rzucie zaznacz, co trafiłeś — liczy się % trafień i łączny score.
      </p>

      <section className="mb-8">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-content-secondary">
          Sektor
        </p>
        <div className="flex flex-wrap gap-2">
          {SECTORS.map((s) => (
            <OptionButton key={s} selected={sector === s} onClick={() => setSector(s)}>
              {s === 'BULL' ? 'Bull' : s}
            </OptionButton>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-content-secondary">
          Limit lotek
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
      </section>

      <Button variant="primary" size="lg" fullWidth onClick={() => onStart(sector, dartsLimit)}>
        Zagraj
      </Button>
    </div>
  );
}
