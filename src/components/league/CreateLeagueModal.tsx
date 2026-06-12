import { useState } from 'react';
import type { LeagueFormat, LeaguePayload } from '../../types/league';
import { Modal } from '../ui/Modal';
import { Toggle } from '../ui/Toggle';

type Props = {
  onConfirm: (payload: LeaguePayload) => void;
  onClose:   () => void;
  loading?:  boolean;
};

const FORMAT_OPTIONS: { value: LeagueFormat; label: string; desc: string }[] = [
  { value: 'legs', label: 'Legi', desc: 'Wynik podawany w legach (np. 5-3)' },
  { value: 'sets', label: 'Sety', desc: 'Wynik podawany w setach (np. 3-1)' },
];

const LEG_OPTIONS  = [3, 5, 7, 9] as const;
const SET_OPTIONS  = [1, 3, 5, 7] as const;
const PAIR_OPTIONS = [1, 2, 3, 4] as const;

export function CreateLeagueModal({ onConfirm, onClose, loading }: Props) {
  const [name,           setName]           = useState('');
  const [matchFormat,    setMatchFormat]    = useState<LeagueFormat>('legs');
  const [legs,           setLegs]           = useState(3);
  const [sets,           setSets]           = useState(1);
  const [matchesPerPair, setMatchesPerPair] = useState(2);
  const [pointsWin,      setPointsWin]      = useState(3);
  const [pointsDraw,     setPointsDraw]     = useState(1);
  const [isPrivate,      setIsPrivate]      = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
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
    <Modal size="lg" onClose={onClose} aria-labelledby="league-modal-title">
      <div className="p-8">
        <h2 id="league-modal-title" className="mb-6 text-xl font-semibold tracking-wide text-brand-white">
          Nowa liga
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

          {/* Name */}
          <Field label="Nazwa ligi">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="np. Liga Środy"
              maxLength={60}
              autoFocus
              className="rounded-lg border border-border-subtle bg-brand-black px-4 py-3 text-sm text-brand-white placeholder:text-content-secondary focus:border-brand-purple focus:outline-none transition-colors"
            />
          </Field>

          {/* Match format */}
          <Field label="Format meczu">
            <div className="grid grid-cols-2 gap-3">
              {FORMAT_OPTIONS.map(({ value, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMatchFormat(value)}
                  className={[
                    'flex flex-col gap-0.5 rounded-lg border px-4 py-3 text-left transition-colors',
                    matchFormat === value
                      ? 'border-brand-purple bg-brand-purple/10 text-brand-white'
                      : 'border-border-subtle bg-brand-black text-content-secondary hover:border-brand-purple/50 hover:text-brand-white',
                  ].join(' ')}
                >
                  <span className="text-sm font-semibold">{label}</span>
                  <span className="text-xs opacity-70">{desc}</span>
                </button>
              ))}
            </div>
          </Field>

          {/* Sets (only for sets format) */}
          {matchFormat === 'sets' && (
            <Field label="Sety (best of)">
              <OptionRow options={SET_OPTIONS} value={sets} onChange={setSets} />
            </Field>
          )}

          {/* Legs */}
          <Field label={matchFormat === 'sets' ? 'Legi na seta (best of)' : 'Legi (best of)'}>
            <OptionRow options={LEG_OPTIONS} value={legs} onChange={setLegs} />
          </Field>

          {/* Matches per pair */}
          <Field label="Mecze z każdym (2 = mecz i rewanż)">
            <OptionRow options={PAIR_OPTIONS} value={matchesPerPair} onChange={setMatchesPerPair} />
          </Field>

          {/* Points */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Punkty za wygraną">
              <input
                type="number"
                min={1}
                max={10}
                value={pointsWin}
                onChange={e => setPointsWin(Number(e.target.value))}
                className="rounded-lg border border-border-subtle bg-brand-black px-4 py-2.5 text-sm text-brand-white focus:border-brand-purple focus:outline-none transition-colors"
              />
            </Field>
            <Field label="Punkty za remis">
              <input
                type="number"
                min={0}
                max={10}
                value={pointsDraw}
                onChange={e => setPointsDraw(Number(e.target.value))}
                className="rounded-lg border border-border-subtle bg-brand-black px-4 py-2.5 text-sm text-brand-white focus:border-brand-purple focus:outline-none transition-colors"
              />
            </Field>
          </div>

          {/* Private toggle */}
          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border-subtle bg-brand-black px-4 py-3 transition-colors hover:border-brand-purple/40">
            <div>
              <p className="text-sm font-medium text-brand-white">Liga prywatna</p>
              <p className="text-xs text-content-secondary">Widoczna tylko dla członków</p>
            </div>
            <Toggle checked={isPrivate} onChange={setIsPrivate} />
          </label>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border-subtle px-5 py-2.5 text-sm font-medium text-content-secondary transition-colors hover:border-brand-white/30 hover:text-brand-white"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={!name.trim() || loading}
              className="rounded-lg bg-brand-purple px-5 py-2.5 text-sm font-semibold text-brand-white transition-opacity disabled:opacity-40 hover:bg-brand-purple/80"
            >
              {loading ? 'Tworzenie…' : 'Utwórz'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-widest text-content-secondary">{label}</span>
      {children}
    </div>
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
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={[
            'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
            value === n
              ? 'border-brand-purple bg-brand-purple text-brand-white'
              : 'border-border-subtle bg-brand-black text-content-secondary hover:border-brand-purple/50 hover:text-brand-white',
          ].join(' ')}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
