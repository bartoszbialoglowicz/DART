import { useEffect, useRef, useState } from 'react';
import type { TournamentConfig, TournamentFormat } from '../../types/tournament';
import { GROUP_PLAYER_COUNTS, KNOCKOUT_PLAYER_COUNTS, LEG_OPTIONS, SET_OPTIONS } from '../../types/tournament';
import { usePlayers } from '../../hooks/usePlayers';
import type { Player } from '../../types/player';
import { Modal } from '../ui/Modal';
import { Toggle } from '../ui/Toggle';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Field } from '../ui/Field';
import { Input } from '../ui/Input';
import { OptionButton } from '../ui/OptionButton';
import { SelectableCard } from '../ui/SelectableCard';
import { SegmentedControl } from '../ui/SegmentedControl';

type Props = {
  onConfirm: (config: TournamentConfig) => void;
  onClose:   () => void;
};

type Step = 'config' | 'players';

const FORMAT_OPTIONS: { value: TournamentFormat; label: string; description: string }[] = [
  { value: 'knockout', label: 'SKO',   description: 'Single Knock-Out — przegrany odpada' },
  { value: 'groups',   label: 'Grupy', description: 'Faza grupowa, potem playoff'          },
];

const DATE_MODE_OPTIONS = [
  { value: 'now'  as const, label: 'Teraz'        },
  { value: 'pick' as const, label: 'Wybierz datę' },
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
      size={step === 'config' ? 'lg' : 'xl'}
      onClose={handleClose}
      title={
        step === 'config'
          ? 'Nowy turniej'
          : (
            <span className="flex items-center gap-3">
              Wybierz graczy
              <Badge variant={canCreate ? 'up' : 'neutral'} mono>
                {selectedIds.size} / {playerCount}
              </Badge>
            </span>
          )
      }
      footer={
        step === 'config' ? (
          <>
            <Button variant="ghost" size="md" onClick={onClose}>Anuluj</Button>
            <Button
              type="submit"
              form="tournament-config-form"
              variant="primary"
              size="md"
              disabled={!name.trim()}
            >
              Dalej →
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" size="md" onClick={() => setStep('config')}>← Wstecz</Button>
            <Button variant="primary" size="md" disabled={!canCreate} onClick={handleCreate}>
              Utwórz
            </Button>
          </>
        )
      }
    >
      {step === 'config' ? (
        <form id="tournament-config-form" onSubmit={handleConfigSubmit} className="flex flex-col gap-5">

          {/* Name */}
          <Field label="Nazwa turnieju">
            <Input
              ref={firstInputRef}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="np. Ligowe Starcie"
              maxLength={60}
            />
          </Field>

          {/* Format */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-widest text-content-secondary">Format</p>
            <div className="grid grid-cols-2 gap-3">
              {FORMAT_OPTIONS.map(({ value, label, description }) => (
                <SelectableCard
                  key={value}
                  layout="row"
                  title={label}
                  description={description}
                  selected={format === value}
                  onClick={() => handleFormatChange(value)}
                />
              ))}
            </div>
          </div>

          {/* Player count */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-widest text-content-secondary">Liczba graczy</p>
            <div className="flex flex-wrap gap-2">
              {counts.map(n => (
                <OptionButton key={n} selected={playerCount === n} onClick={() => setPlayerCount(n)}>
                  {n}
                </OptionButton>
              ))}
            </div>
          </div>

          {/* Sets */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-widest text-content-secondary">Sety (best of)</p>
            <div className="flex flex-wrap gap-2">
              {SET_OPTIONS.map(n => (
                <OptionButton key={n} selected={sets === n} onClick={() => setSets(n)}>
                  {n}
                </OptionButton>
              ))}
            </div>
          </div>

          {/* Legs */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-widest text-content-secondary">Legi (best of)</p>
            <div className="flex flex-wrap gap-2">
              {LEG_OPTIONS.map(n => (
                <OptionButton key={n} selected={legs === n} onClick={() => setLegs(n)}>
                  {n}
                </OptionButton>
              ))}
            </div>
          </div>

          {/* Start date */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-widest text-content-secondary">Data rozpoczęcia</p>
            <SegmentedControl
              className='self-start'
              value={dateMode}
              onChange={setDateMode}
              options={DATE_MODE_OPTIONS}
            />
            {dateMode === 'pick' && (
              <Input
                type="datetime-local"
                value={pickedDate}
                onChange={e => setPickedDate(e.target.value)}
              />
            )}
          </div>

          {/* Private toggle */}
          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border-subtle bg-surface-muted px-4 py-3">
            <div>
              <p className="text-sm font-medium text-content-primary">Turniej prywatny</p>
              <p className="text-xs text-content-secondary">Widoczny tylko dla zaproszonych graczy</p>
            </div>
            <Toggle checked={isPrivate} onChange={setIsPrivate} />
          </label>

        </form>
      ) : (
        <>
          <Input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Szukaj gracza..."
            autoFocus
            className="mb-4"
          />

          <div className="mb-4 flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
            {isLoading && (
              <p className="py-10 text-center text-sm text-content-secondary">Ładowanie graczy…</p>
            )}
            {isError && (
              <p className="py-10 text-center text-sm text-score-down-text">Nie udało się pobrać listy graczy.</p>
            )}
            {!isLoading && !isError && filtered.length === 0 && (
              <p className="py-10 text-center text-sm text-content-secondary">Brak graczy.</p>
            )}
            {filtered.map(player => {
              const selected = selectedIds.has(player.id);
              const maxed    = !selected && selectedIds.size >= playerCount;
              return (
                <SelectableCard
                  key={player.id}
                  layout="row"
                  title={`${player.first_name} ${player.last_name}`}
                  meta={`śr. ${player.average}`}
                  selected={selected}
                  disabled={maxed}
                  onClick={() => togglePlayer(player.id)}
                />
              );
            })}
          </div>

          {!isLoading && !isError && allPlayers.length < playerCount && (
            <p className="mb-4 text-xs text-rank-text">
              W bazie jest tylko {allPlayers.length} {allPlayers.length === 1 ? 'gracz' : 'graczy'}, a turniej wymaga {playerCount}.
            </p>
          )}
        </>
      )}
    </Modal>
  );
}
