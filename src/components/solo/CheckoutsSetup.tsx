import { useState } from 'react';
import { Button } from '../ui/Button';
import { SelectableCard } from '../ui/SelectableCard';
import type { CheckoutsMode } from './CheckoutsGame';

type Props = {
  onStart: (mode: CheckoutsMode) => void;
  onBack:  () => void;
};

export function CheckoutsSetup({ onStart, onBack }: Props) {
  const [mode, setMode] = useState<CheckoutsMode>('easy');

  return (
    <div className="mx-auto w-full max-w-sm px-6 py-8">
      <Button variant="ghost" size="md" onClick={onBack} className="mb-6">
        ← Wróć
      </Button>

      <h2 className="mb-2 text-lg font-semibold text-content-primary">Checkouts</h2>
      <p className="mb-8 text-xs text-content-secondary leading-relaxed">
        Zacznij od D20 (40). Zamknięcie w 3 lotkach → +10 pkt. Brak → −1 pkt (min. 40).
      </p>

      <section className="mb-8">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-content-secondary">
          Tryb
        </p>
        <div className="flex flex-col gap-2">
          <SelectableCard
            selected={mode === 'easy'}
            tone="accent"
            title="Easy"
            meta="Gra trwa bez limitu"
            onClick={() => setMode('easy')}
          />
          <SelectableCard
            selected={mode === 'hard'}
            tone="danger"
            title="Hard"
            meta="Koniec przy braku na 40"
            onClick={() => setMode('hard')}
          />
        </div>
      </section>

      <Button variant="primary" size="lg" fullWidth onClick={() => onStart(mode)}>
        Zagraj
      </Button>
    </div>
  );
}
