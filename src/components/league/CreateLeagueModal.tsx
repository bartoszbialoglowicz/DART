import { useState } from 'react';
import type { LeagueFormat, LeaguePayload } from '../../types/league';
import type { Venue } from '../../types/venue';
import { SET_MIN, SET_MAX, LEG_MIN, LEG_MAX, roundToNearestOdd } from '../../types/tournament';
import { Modal } from '../ui/Modal';
import { Toggle } from '../ui/Toggle';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { OptionButton } from '../ui/OptionButton';
import { SelectableCard } from '../ui/SelectableCard';
import { Field } from '../ui/Field';
import { BestOfField } from '../tournament/BestOfField';
import { VenuePicker } from '../venue/VenuePicker';

type Props = {
  onConfirm: (payload: LeaguePayload) => void;
  onClose:   () => void;
  loading?:  boolean;
};

const FORMAT_OPTIONS: { value: LeagueFormat; label: string; desc: string }[] = [
  { value: 'legs', label: 'Legi', desc: 'Wynik podawany w legach (np. 5-3)' },
  { value: 'sets', label: 'Sety', desc: 'Wynik podawany w setach (np. 3-1)' },
];

const PAIR_OPTIONS = [1, 2, 3, 4] as const;

export function CreateLeagueModal({ onConfirm, onClose, loading }: Props) {
  const [name,           setName]           = useState('');
  const [matchFormat,    setMatchFormat]    = useState<LeagueFormat>('legs');
  const [legsInput,      setLegsInput]      = useState('3');
  const [setsInput,      setSetsInput]      = useState(String(SET_MIN));
  const [matchesPerPair, setMatchesPerPair] = useState(2);
  const [pointsWin,      setPointsWin]      = useState(3);
  const [pointsDraw,     setPointsDraw]     = useState(1);
  const [isPrivate,      setIsPrivate]      = useState(false);
  const [venue,          setVenue]          = useState<Venue | null>(null);

  const sets = roundToNearestOdd(Number(setsInput), SET_MIN, SET_MAX);
  const legs = roundToNearestOdd(Number(legsInput), LEG_MIN, LEG_MAX);

  function handleVenueChange(next: Venue | null) {
    setVenue(next);
    if (next) {
      setSetsInput(String(next.default_sets));
      setLegsInput(String(next.default_legs));
    }
  }

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!name.trim()) return;
    onConfirm({
      name:             name.trim(),
      is_private:       isPrivate,
      matches_per_pair: matchesPerPair,
      points_win:       pointsWin,
      points_draw:      pointsDraw,
      match_format:     matchFormat,
      sets,
      legs,
    });
  }

  return (
    <Modal title="Nowa liga" size="lg" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        <Field label="Nazwa ligi">
          <Input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="np. Liga Środy"
            maxLength={60}
            autoFocus
          />
        </Field>

        <Field label="Lokal">
          <VenuePicker selectedId={venue?.id ?? null} onChange={handleVenueChange} />
          {venue && (
            <p className="mt-1 text-xs text-content-faint">
              Domyślny format lokalu zastosowany — możesz go zmienić poniżej.
            </p>
          )}
        </Field>

        <Field label="Format meczu">
          <div className="grid grid-cols-2 gap-3">
            {FORMAT_OPTIONS.map(({ value, label, desc }) => (
              <SelectableCard
                key={value}
                layout="stack"
                selected={matchFormat === value}
                onClick={() => setMatchFormat(value)}
                title={label}
                description={desc}
              />
            ))}
          </div>
        </Field>

        {matchFormat === 'sets' && (
          <Field label="Sety (best of)">
            <BestOfField value={setsInput} min={SET_MIN} max={SET_MAX} onChange={setSetsInput} onBlur={() => setSetsInput(String(sets))} />
          </Field>
        )}

        <Field label={matchFormat === 'sets' ? 'Legi na seta (best of)' : 'Legi (best of)'}>
          <BestOfField value={legsInput} min={LEG_MIN} max={LEG_MAX} onChange={setLegsInput} onBlur={() => setLegsInput(String(legs))} />
        </Field>

        <Field label="Mecze z każdym (2 = mecz i rewanż)">
          <OptionRow options={PAIR_OPTIONS} value={matchesPerPair} onChange={setMatchesPerPair} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Punkty za wygraną">
            <Input
              type="number"
              min={1}
              max={10}
              value={pointsWin}
              onChange={e => setPointsWin(Number(e.target.value))}
            />
          </Field>
          <Field label="Punkty za remis">
            <Input
              type="number"
              min={0}
              max={10}
              value={pointsDraw}
              onChange={e => setPointsDraw(Number(e.target.value))}
            />
          </Field>
        </div>

        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border-subtle bg-surface-muted px-4 py-3">
          <div>
            <p className="text-sm font-medium text-content-primary">Liga prywatna</p>
            <p className="text-xs text-content-secondary">Widoczna tylko dla członków</p>
          </div>
          <Toggle checked={isPrivate} onChange={setIsPrivate} />
        </label>

        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Anuluj</Button>
          <Button type="submit" variant="primary" loading={loading} disabled={!name.trim() || loading}>
            Utwórz
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function OptionRow<T extends number>({ options, value, onChange }: {
  options:  readonly T[];
  value:    T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(n => (
        <OptionButton key={n} selected={value === n} onClick={() => onChange(n)}>
          {n}
        </OptionButton>
      ))}
    </div>
  );
}
