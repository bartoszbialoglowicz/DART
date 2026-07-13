import { useState } from 'react';
import { Button } from '../ui/Button';
import { OptionButton } from '../ui/OptionButton';

const LEGS_OPTIONS = [1, 3, 5, 10] as const;

type Props = {
  onStart: (legsTarget: number) => void;
  onBack:  () => void;
};

export function Solo501Setup({ onStart, onBack }: Props) {
  const [legsTarget, setLegsTarget] = useState<number>(LEGS_OPTIONS[1]);

  return (
    <div className="mx-auto w-full max-w-sm px-6 py-8">
      <Button variant="ghost" size="md" onClick={onBack} className="mb-6">
        ← Wróć
      </Button>

      <h2 className="mb-2 text-lg font-semibold text-content-primary">501 Solo</h2>
      <p className="mb-8 text-xs text-content-secondary leading-relaxed">
        Trenuj 501 samodzielnie — bez przeciwnika, zamknij tyle legów ile wybierzesz.
      </p>

      <section className="mb-8">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-content-secondary">
          Liczba legów
        </p>
        <div className="flex flex-wrap gap-2">
          {LEGS_OPTIONS.map((n) => (
            <OptionButton key={n} selected={legsTarget === n} onClick={() => setLegsTarget(n)}>{n}</OptionButton>
          ))}
        </div>
      </section>

      <Button variant="primary" size="lg" fullWidth onClick={() => onStart(legsTarget)}>
        Zagraj
      </Button>
    </div>
  );
}
