import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateTournamentCycle } from '../hooks/useTournamentCycles';
import { DEFAULT_PLACEMENT_POINTS } from '../types/tournamentCycle';
import type { CycleEventInput, CycleScoringMode, PlacementPoints } from '../types/tournamentCycle';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import { Toggle } from '../components/ui/Toggle';
import { SelectableCard } from '../components/ui/SelectableCard';

const PLACEMENT_TIER_LABELS: { key: keyof PlacementPoints; label: string }[] = [
  { key: 'winner',       label: 'Zwycięzca' },
  { key: 'final',        label: 'Finał' },
  { key: 'semifinal',    label: 'Półfinał' },
  { key: 'quarterfinal', label: 'Ćwierćfinał' },
  { key: 'other',        label: 'Pozostali' },
];

export function CreateCyclePage() {
  const navigate = useNavigate();
  const createCycle = useCreateTournamentCycle();

  const [name,       setName]       = useState('');
  const [isPrivate,  setIsPrivate]  = useState(false);
  const [scoringMode, setScoringMode] = useState<CycleScoringMode>('placement');
  const [placementPoints, setPlacementPoints] = useState<PlacementPoints>(DEFAULT_PLACEMENT_POINTS);

  const [bonus180Enabled, setBonus180Enabled] = useState(false);
  const [bonus180,        setBonus180]        = useState(5);
  const [bonusCheckoutEnabled, setBonusCheckoutEnabled] = useState(false);
  const [bonusCheckout,        setBonusCheckout]        = useState(5);

  const [events, setEvents] = useState<CycleEventInput[]>([{ name: 'Etap 1', planned_date: null }]);

  function updatePlacementPoint(key: keyof PlacementPoints, value: string) {
    const n = Number(value);
    setPlacementPoints(prev => ({ ...prev, [key]: Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0 }));
  }

  function updateEvent(index: number, patch: Partial<CycleEventInput>) {
    setEvents(prev => prev.map((ev, i) => i === index ? { ...ev, ...patch } : ev));
  }

  function addEvent() {
    setEvents(prev => [...prev, { name: `Etap ${prev.length + 1}`, planned_date: null }]);
  }

  function removeEvent(index: number) {
    setEvents(prev => prev.filter((_, i) => i !== index));
  }

  const canSubmit = name.trim() !== '' && events.every(ev => ev.name.trim() !== '');

  function handleSubmit() {
    if (!canSubmit) return;
    createCycle.mutate({
      name: name.trim(),
      is_private: isPrivate,
      scoring_mode: scoringMode,
      placement_points: placementPoints,
      bonus_180_points: bonus180Enabled ? bonus180 : null,
      bonus_high_checkout_points: bonusCheckoutEnabled ? bonusCheckout : null,
      events,
    }, {
      onSuccess: (cycle) => navigate(`/ligi/cykle/${cycle.id}`),
    });
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
      <Button variant="ghost" size="md" onClick={() => navigate('/ligi')} className="mb-6">
        ← Wróć
      </Button>

      <h1 className="mb-6 text-xl font-semibold text-content-primary">Nowy cykl turniejowy</h1>

      <div className="flex flex-col gap-6 max-w-2xl">
        <Field label="Nazwa cyklu">
          <Input
            autoFocus
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="np. Sezon 2026"
            maxLength={100}
          />
        </Field>

        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border-subtle bg-surface-muted px-4 py-3">
          <div>
            <p className="text-sm font-medium text-content-primary">Cykl prywatny</p>
            <p className="text-xs text-content-secondary">Widoczny tylko dla Ciebie i uczestników turniejów</p>
          </div>
          <Toggle checked={isPrivate} onChange={setIsPrivate} />
        </label>

        {/* Scoring mode */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-widest text-content-secondary">Punktacja</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SelectableCard
              selected={scoringMode === 'placement'}
              title="Punkty za miejsce"
              description="Zwycięzca, finalista, półfinalista itd. dostają stałą liczbę punktów niezależnie od wielkości turnieju."
              onClick={() => setScoringMode('placement')}
            />
            <SelectableCard
              selected={scoringMode === 'match_wins'}
              title="Suma wygranych meczy"
              description="Liczy się łączna liczba wygranych meczy ze wszystkich turniejów cyklu."
              onClick={() => setScoringMode('match_wins')}
            />
          </div>
        </div>

        {scoringMode === 'placement' && (
          <div className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface-overlay p-4">
            <p className="text-xs font-medium uppercase tracking-widest text-content-secondary">
              Punkty za etap dotarcia
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {PLACEMENT_TIER_LABELS.map(({ key, label }) => (
                <Field key={key} label={label}>
                  <Input
                    type="number"
                    min={0}
                    value={String(placementPoints[key])}
                    onChange={e => updatePlacementPoint(key, e.target.value)}
                  />
                </Field>
              ))}
            </div>
          </div>
        )}

        {/* Bonuses */}
        <div className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface-overlay p-4">
          <p className="text-xs font-medium uppercase tracking-widest text-content-secondary">Bonusy (opcjonalne)</p>

          <label className="flex cursor-pointer items-center justify-between">
            <p className="text-sm text-content-primary">Punkty za 180</p>
            <Toggle checked={bonus180Enabled} onChange={setBonus180Enabled} />
          </label>
          {bonus180Enabled && (
            <Field label="Punktów za każde 180" className="max-w-40">
              <Input type="number" min={0} value={String(bonus180)} onChange={e => setBonus180(Math.max(0, Math.round(Number(e.target.value) || 0)))} />
            </Field>
          )}

          <label className="flex cursor-pointer items-center justify-between">
            <p className="text-sm text-content-primary">Punkty za wysoki checkout (100+)</p>
            <Toggle checked={bonusCheckoutEnabled} onChange={setBonusCheckoutEnabled} />
          </label>
          {bonusCheckoutEnabled && (
            <Field label="Punktów za każdy wysoki checkout" className="max-w-40">
              <Input type="number" min={0} value={String(bonusCheckout)} onChange={e => setBonusCheckout(Math.max(0, Math.round(Number(e.target.value) || 0)))} />
            </Field>
          )}
        </div>

        {/* Events calendar */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-widest text-content-secondary">
            Kalendarz turniejów
          </p>
          <div className="flex flex-col gap-2">
            {events.map((ev, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-overlay p-3">
                <Input
                  type="text"
                  value={ev.name}
                  onChange={e => updateEvent(i, { name: e.target.value })}
                  placeholder={`Etap ${i + 1}`}
                  className="flex-1"
                />
                <Input
                  type="date"
                  value={ev.planned_date ?? ''}
                  onChange={e => updateEvent(i, { planned_date: e.target.value || null })}
                  className="max-w-40 shrink-0"
                />
                {events.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeEvent(i)}
                    className="shrink-0 text-content-faint transition-colors hover:text-content-primary"
                    aria-label="Usuń wydarzenie"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={addEvent} className="self-start">
            + Dodaj wydarzenie
          </Button>
        </div>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!canSubmit}
          loading={createCycle.isPending}
          onClick={handleSubmit}
        >
          Utwórz cykl
        </Button>
      </div>
    </div>
  );
}
