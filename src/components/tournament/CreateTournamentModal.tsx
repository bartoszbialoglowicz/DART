import { useEffect, useRef, useState } from 'react';
import type { TournamentConfig, TournamentFormat } from '../../types/tournament';
import { GROUP_PLAYER_COUNTS, KNOCKOUT_PLAYER_COUNTS, LEG_OPTIONS, SET_OPTIONS } from '../../types/tournament';
import { usePlayers } from '../../hooks/usePlayers';
import type { Player } from '../../types/player';

type Props = {
  onConfirm: (config: TournamentConfig) => void;
  onClose: () => void;
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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [search, setSearch]           = useState('');

  const overlayRef    = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError } = usePlayers();
  const allPlayers: Player[] = data?.results ?? [];

  useEffect(() => {
    if (step === 'config') firstInputRef.current?.focus();
  }, [step]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (step === 'players') setStep('config');
        else onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, step]);

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose();
  }

  function handleFormatChange(next: TournamentFormat) {
    setFormat(next);
    const defaults = next === 'knockout' ? KNOCKOUT_PLAYER_COUNTS : GROUP_PLAYER_COUNTS;
    setPlayerCount(defaults[1]);
  }

  function handleConfigSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return;
    setSelectedIds(new Set());
    setSearch('');
    setStep('players');
  }

  function togglePlayer(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < playerCount) {
        next.add(id);
      }
      return next;
    });
  }

  function handleCreate() {
    const selected = allPlayers.filter(p => selectedIds.has(p.id));
    onConfirm({ name: name.trim(), playerCount, format, matchFormat: { sets, legs }, players: selected });
  }

  const counts    = format === 'knockout' ? KNOCKOUT_PLAYER_COUNTS : GROUP_PLAYER_COUNTS;
  const canCreate = selectedIds.size === playerCount;
  const filtered  = allPlayers.filter(p =>
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className={[
          'w-full rounded-xl border border-border-subtle bg-surface-overlay p-8 shadow-2xl transition-all duration-200',
          step === 'config' ? 'max-w-md' : 'max-w-lg',
        ].join(' ')}
      >
        {step === 'config' ? (
          <>
            <h2 id="modal-title" className="mb-6 text-xl font-semibold tracking-wide text-brand-white">
              Nowy turniej
            </h2>

            <form onSubmit={handleConfigSubmit} className="flex flex-col gap-6">
              {/* Name */}
              <div className="flex flex-col gap-2">
                <label htmlFor="tournament-name" className="text-xs font-medium tracking-widest text-content-secondary uppercase">
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
                <span className="text-xs font-medium tracking-widests text-content-secondary uppercase">Format</span>
                <div className="grid grid-cols-2 gap-3">
                  {FORMAT_OPTIONS.map(({ value, label, description }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleFormatChange(value)}
                      className={[
                        'flex flex-col gap-1 rounded-lg border px-4 py-3 text-left transition-colors duration-150',
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
                <span className="text-xs font-medium tracking-widests text-content-secondary uppercase">
                  Liczba graczy
                </span>
                <div className="flex flex-wrap gap-2">
                  {counts.map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPlayerCount(n)}
                      className={[
                        'rounded-lg border px-4 py-2 text-sm font-medium transition-colors duration-150',
                        playerCount === n
                          ? 'border-brand-purple bg-brand-purple text-brand-white'
                          : 'border-border-subtle bg-brand-black text-content-secondary hover:border-brand-purple/50 hover:text-brand-white',
                      ].join(' ')}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sets */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium tracking-widest text-content-secondary uppercase">
                  Sety (best of)
                </span>
                <div className="flex flex-wrap gap-2">
                  {SET_OPTIONS.map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSets(n)}
                      className={[
                        'rounded-lg border px-4 py-2 text-sm font-medium transition-colors duration-150',
                        sets === n
                          ? 'border-brand-purple bg-brand-purple text-brand-white'
                          : 'border-border-subtle bg-brand-black text-content-secondary hover:border-brand-purple/50 hover:text-brand-white',
                      ].join(' ')}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Legs */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium tracking-widest text-content-secondary uppercase">
                  Legi (best of)
                </span>
                <div className="flex flex-wrap gap-2">
                  {LEG_OPTIONS.map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setLegs(n)}
                      className={[
                        'rounded-lg border px-4 py-2 text-sm font-medium transition-colors duration-150',
                        legs === n
                          ? 'border-brand-purple bg-brand-purple text-brand-white'
                          : 'border-border-subtle bg-brand-black text-content-secondary hover:border-brand-purple/50 hover:text-brand-white',
                      ].join(' ')}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-border-subtle px-5 py-2.5 text-sm font-medium text-content-secondary transition-colors hover:border-brand-white/30 hover:text-brand-white"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={!name.trim()}
                  className="rounded-lg bg-brand-purple px-5 py-2.5 text-sm font-semibold text-brand-white transition-opacity disabled:opacity-40 hover:bg-brand-purple-500"
                >
                  Dalej →
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <h2 id="modal-title" className="text-xl font-semibold tracking-wide text-brand-white">
                Wybierz graczy
              </h2>
              <span
                className={[
                  'text-sm font-semibold tabular-nums',
                  canCreate ? 'text-brand-purple' : 'text-content-secondary',
                ].join(' ')}
              >
                {selectedIds.size} / {playerCount}
              </span>
            </div>

            {/* Search */}
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Szukaj gracza..."
              autoFocus
              className="mb-4 w-full rounded-lg border border-border-subtle bg-brand-black px-4 py-2.5 text-sm text-brand-white placeholder:text-content-secondary focus:border-brand-purple focus:outline-none transition-colors"
            />

            {/* Player list */}
            <div className="mb-4 flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
              {isLoading && (
                <p className="py-10 text-center text-sm text-content-secondary">Ładowanie graczy…</p>
              )}
              {isError && (
                <p className="py-10 text-center text-sm text-red-400">Nie udało się pobrać listy graczy.</p>
              )}
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
                      'flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors duration-150',
                      selected
                        ? 'border-brand-purple bg-brand-purple/10 text-brand-white'
                        : maxed
                          ? 'cursor-not-allowed border-border-subtle bg-brand-black text-content-secondary opacity-30'
                          : 'border-border-subtle bg-brand-black text-content-secondary hover:border-brand-purple/50 hover:text-brand-white',
                    ].join(' ')}
                  >
                    <span className="text-sm font-medium">
                      {player.first_name} {player.last_name}
                    </span>
                    <span className="text-xs text-content-secondary">śr. {player.average}</span>
                  </button>
                );
              })}
            </div>

            {/* Not enough players warning */}
            {!isLoading && !isError && allPlayers.length < playerCount && (
              <p className="mb-4 text-xs text-amber-400">
                W bazie jest tylko {allPlayers.length} {allPlayers.length === 1 ? 'gracz' : 'graczy'}, a turniej wymaga {playerCount}.
              </p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setStep('config')}
                className="rounded-lg border border-border-subtle px-5 py-2.5 text-sm font-medium text-content-secondary transition-colors hover:border-brand-white/30 hover:text-brand-white"
              >
                ← Wstecz
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!canCreate}
                className="rounded-lg bg-brand-purple px-5 py-2.5 text-sm font-semibold text-brand-white transition-opacity disabled:opacity-40 hover:bg-brand-purple-500"
              >
                Utwórz
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
