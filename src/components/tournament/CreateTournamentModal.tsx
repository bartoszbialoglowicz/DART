import { useEffect, useRef, useState } from 'react';
import type { TournamentConfig, TournamentFormat } from '../../types/tournament';
import { GROUP_PLAYER_COUNTS, KNOCKOUT_PLAYER_COUNTS, LEG_OPTIONS, SET_OPTIONS } from '../../types/tournament';
import { usePlayers } from '../../hooks/usePlayers';
import type { Player } from '../../types/player';
import { Modal } from '../ui/Modal';
import { Toggle } from '../ui/Toggle';

type Props = {
  onConfirm: (config: TournamentConfig) => void;
  onClose:   () => void;
};

type Step = 'config' | 'players';

const FORMAT_OPTIONS: { value: TournamentFormat; label: string; description: string }[] = [
  { value: 'knockout', label: 'SKO',   description: 'Single Knock-Out — przegrany odpada' },
  { value: 'groups',   label: 'Grupy', description: 'Faza grupowa, potem playoff'          },
];

export function CreateTournamentModal({ onConfirm, onClose }: Props) {
  const [step, setStep]               = useState<Step>('config');
  const [name, setName]               = useState('');
  const [format, setFormat]           = useState<TournamentFormat>('knockout');
  const [playerCount, setPlayerCount] = useState<number>(KNOCKOUT_PLAYER_COUNTS[1]);
  const [sets, setSets]               = useState<number>(SET_OPTIONS[0]);
  const [legs, setLegs]               = useState<number>(LEG_OPTIONS[0]);
  const [isPrivate, setIsPrivate]     = useState(false);
  const [dateMode, setDateMode]       = useState<'now' | 'pick'>('now');
  const [pickedDate, setPickedDate]   = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [search, setSearch]           = useState('');

  const firstInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError } = usePlayers();
  const allPlayers: Player[] = data ?? [];

  useEffect(() => {
    if (step === 'config') firstInputRef.current?.focus();
  }, [step]);

  // ESC in 'players' step goes back to config instead of closing
  const handleClose = step === 'players' ? () => setStep('config') : onClose;

  function handleFormatChange(next: TournamentFormat) {
    setFormat(next);
    setPlayerCount((next === 'knockout' ? KNOCKOUT_PLAYER_COUNTS : GROUP_PLAYER_COUNTS)[1]);
  }

  function handleConfigSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!name.trim()) return;
    setSelectedIds(new Set());
    setSearch('');
    setStep('players');
  }

  function togglePlayer(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < playerCount) next.add(id);
      return next;
    });
  }

  function handleCreate() {
    const selected   = allPlayers.filter(p => selectedIds.has(p.id));
    const start_date = dateMode === 'pick' && pickedDate ? pickedDate : null;
    onConfirm({ name: name.trim(), playerCount, format, matchFormat: { sets, legs }, players: selected, is_private: isPrivate, start_date });
  }

  const counts    = format === 'knockout' ? KNOCKOUT_PLAYER_COUNTS : GROUP_PLAYER_COUNTS;
  const canCreate = selectedIds.size === playerCount;
  const filtered  = allPlayers.filter(p =>
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal
      size={step === 'config' ? 'md' : 'lg'}
      onClose={handleClose}
      aria-labelledby="tournament-modal-title"
    >
      <div className="p-8">
        {step === 'config' ? (
          <>
            <h2 id="tournament-modal-title" className="mb-6 text-xl font-semibold tracking-wide text-brand-white">
              Nowy turniej
            </h2>

            <form onSubmit={handleConfigSubmit} className="flex flex-col gap-6">
              {/* Name */}
              <div className="flex flex-col gap-2">
                <label htmlFor="tournament-name" className="text-xs font-medium uppercase tracking-widest text-content-secondary">
                  Nazwa turnieju
                </label>
                <input
                  ref={firstInputRef}
                  id="tournament-name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="np. Ligowe Starcie"
                  maxLength={60}
                  className="rounded-lg border border-border-subtle bg-brand-black px-4 py-3 text-sm text-brand-white placeholder:text-content-secondary focus:border-brand-purple focus:outline-none transition-colors"
                />
              </div>

              {/* Format */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase tracking-widest text-content-secondary">Format</span>
                <div className="grid grid-cols-2 gap-3">
                  {FORMAT_OPTIONS.map(({ value, label, description }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleFormatChange(value)}
                      className={[
                        'flex flex-col gap-1 rounded-lg border px-4 py-3 text-left transition-colors',
                        format === value
                          ? 'border-brand-purple bg-brand-purple/10 text-brand-white'
                          : 'border-border-subtle bg-brand-black text-content-secondary hover:border-brand-purple/50 hover:text-brand-white',
                      ].join(' ')}
                    >
                      <span className="text-sm font-semibold">{label}</span>
                      <span className="text-xs leading-snug opacity-70">{description}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Player count */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase tracking-widest text-content-secondary">Liczba graczy</span>
                <div className="flex flex-wrap gap-2">
                  {counts.map(n => (
                    <button key={n} type="button" onClick={() => setPlayerCount(n)}
                      className={chipClass(playerCount === n)}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sets */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase tracking-widest text-content-secondary">Sety (best of)</span>
                <div className="flex flex-wrap gap-2">
                  {SET_OPTIONS.map(n => (
                    <button key={n} type="button" onClick={() => setSets(n)}
                      className={chipClass(sets === n)}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Legs */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase tracking-widest text-content-secondary">Legi (best of)</span>
                <div className="flex flex-wrap gap-2">
                  {LEG_OPTIONS.map(n => (
                    <button key={n} type="button" onClick={() => setLegs(n)}
                      className={chipClass(legs === n)}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Start date */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase tracking-widest text-content-secondary">Data rozpoczęcia</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setDateMode('now')}
                    className={chipClass(dateMode === 'now')}>
                    Teraz
                  </button>
                  <button type="button" onClick={() => setDateMode('pick')}
                    className={chipClass(dateMode === 'pick')}>
                    Wybierz datę
                  </button>
                </div>
                {dateMode === 'pick' && (
                  <input
                    type="datetime-local"
                    value={pickedDate}
                    onChange={e => setPickedDate(e.target.value)}
                    className="rounded-lg border border-border-subtle bg-brand-black px-4 py-2.5 text-sm text-brand-white focus:border-brand-purple focus:outline-none transition-colors [color-scheme:dark]"
                  />
                )}
              </div>

              {/* Private toggle */}
              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border-subtle bg-brand-black px-4 py-3 transition-colors hover:border-brand-purple/40">
                <div>
                  <p className="text-sm font-medium text-brand-white">Turniej prywatny</p>
                  <p className="text-xs text-content-secondary">Widoczny tylko dla zaproszonych graczy</p>
                </div>
                <Toggle checked={isPrivate} onChange={setIsPrivate} />
              </label>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={onClose}
                  className="rounded-lg border border-border-subtle px-5 py-2.5 text-sm font-medium text-content-secondary transition-colors hover:border-brand-white/30 hover:text-brand-white">
                  Anuluj
                </button>
                <button type="submit" disabled={!name.trim()}
                  className="rounded-lg bg-brand-purple px-5 py-2.5 text-sm font-semibold text-brand-white transition-opacity disabled:opacity-40 hover:bg-brand-purple/80">
                  Dalej →
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <h2 id="tournament-modal-title" className="text-xl font-semibold tracking-wide text-brand-white">
                Wybierz graczy
              </h2>
              <span className={['text-sm font-semibold tabular-nums', canCreate ? 'text-brand-purple' : 'text-content-secondary'].join(' ')}>
                {selectedIds.size} / {playerCount}
              </span>
            </div>

            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Szukaj gracza..."
              autoFocus
              className="mb-4 w-full rounded-lg border border-border-subtle bg-brand-black px-4 py-2.5 text-sm text-brand-white placeholder:text-content-secondary focus:border-brand-purple focus:outline-none transition-colors"
            />

            <div className="mb-4 flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
              {isLoading && <p className="py-10 text-center text-sm text-content-secondary">Ładowanie graczy…</p>}
              {isError   && <p className="py-10 text-center text-sm text-red-400">Nie udało się pobrać listy graczy.</p>}
              {!isLoading && !isError && filtered.length === 0 && (
                <p className="py-10 text-center text-sm text-content-secondary">Brak graczy.</p>
              )}
              {filtered.map(player => {
                const selected = selectedIds.has(player.id);
                const maxed    = !selected && selectedIds.size >= playerCount;
                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => togglePlayer(player.id)}
                    disabled={maxed}
                    className={[
                      'flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors',
                      selected ? 'border-brand-purple bg-brand-purple/10 text-brand-white'
                        : maxed ? 'cursor-not-allowed border-border-subtle bg-brand-black text-content-secondary opacity-30'
                          : 'border-border-subtle bg-brand-black text-content-secondary hover:border-brand-purple/50 hover:text-brand-white',
                    ].join(' ')}
                  >
                    <span className="text-sm font-medium">{player.first_name} {player.last_name}</span>
                    <span className="text-xs text-content-secondary">śr. {player.average}</span>
                  </button>
                );
              })}
            </div>

            {!isLoading && !isError && allPlayers.length < playerCount && (
              <p className="mb-4 text-xs text-amber-400">
                W bazie jest tylko {allPlayers.length} {allPlayers.length === 1 ? 'gracz' : 'graczy'}, a turniej wymaga {playerCount}.
              </p>
            )}

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setStep('config')}
                className="rounded-lg border border-border-subtle px-5 py-2.5 text-sm font-medium text-content-secondary transition-colors hover:border-brand-white/30 hover:text-brand-white">
                ← Wstecz
              </button>
              <button type="button" onClick={handleCreate} disabled={!canCreate}
                className="rounded-lg bg-brand-purple px-5 py-2.5 text-sm font-semibold text-brand-white transition-opacity disabled:opacity-40 hover:bg-brand-purple/80">
                Utwórz
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function chipClass(active: boolean) {
  return [
    'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
    active
      ? 'border-brand-purple bg-brand-purple text-brand-white'
      : 'border-border-subtle bg-brand-black text-content-secondary hover:border-brand-purple/50 hover:text-brand-white',
  ].join(' ');
}

