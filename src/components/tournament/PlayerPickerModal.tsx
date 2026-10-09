import { useState } from 'react';
import type { Player } from '../../types/player';
import type { TournamentPlayer } from '../../types/tournament';
import { usePlayers } from '../../hooks/usePlayers';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { SegmentedControl } from '../ui/SegmentedControl';
import { SkillIcon } from '../ui/SkillIcon';

type Mode = 'player' | 'cpu';

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: 'player', label: 'Zarejestrowani' },
  { value: 'cpu',    label: 'Boty'           },
];

function toTournamentPlayer(p: Player): TournamentPlayer {
  return { id: p.id, first_name: p.first_name, last_name: p.last_name, average: p.average, cpu: p.cpu };
}

type Props = {
  initialSelected: TournamentPlayer[];
  /** Max players this picker may hold; null = no limit. */
  capacity?:       number | null;
  onConfirm:       (players: TournamentPlayer[]) => void;
  onClose:         () => void;
};

export function PlayerPickerModal({ initialSelected, capacity = null, onConfirm, onClose }: Props) {
  const { data: playersData } = usePlayers();
  const allPlayers: Player[]  = playersData ?? [];

  const [mode, setMode]       = useState<Mode>('player');
  const [search, setSearch]   = useState('');
  const [selected, setSelected] = useState<TournamentPlayer[]>(initialSelected);
  const [limitHit, setLimitHit] = useState(false);

  const atCapacity = capacity != null && selected.length >= capacity;

  const selectedIds = new Set(selected.map(p => p.id));

  const sourceList = allPlayers
    .filter(p => (mode === 'cpu' ? p.cpu : !p.cpu))
    .filter(p => !selectedIds.has(p.id))
    .filter(p =>
      search === '' ||
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()),
    );

  function pick(player: Player) {
    if (atCapacity) {
      setLimitHit(true);
      return;
    }
    setSelected(prev => [...prev, toTournamentPlayer(player)]);
  }

  function unpick(id: number) {
    setLimitHit(false);
    setSelected(prev => prev.filter(p => p.id !== id));
  }

  return (
    <Modal
      size="xl"
      title="Wybierz graczy"
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm tabular-nums text-content-secondary">
              {capacity != null
                ? `${selected.length} / ${capacity} graczy`
                : `${selected.length} ${selected.length === 1 ? 'gracz wybrany' : 'graczy wybranych'}`}
            </span>
            {limitHit && atCapacity && (
              <span role="status" className="text-xs text-score-down-text">
                Osiągnięto limit — usuń kogoś, aby dodać innego gracza.
              </span>
            )}
          </div>
          <Button variant="primary" onClick={() => onConfirm(selected)}>
            Zapisz
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <SegmentedControl
          fullWidth
          aria-label="Typ gracza"
          value={mode}
          onChange={v => { setMode(v); setSearch(''); }}
          options={MODE_OPTIONS}
        />

        <Input
          type="text"
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={mode === 'cpu' ? 'Szukaj bota…' : 'Szukaj gracza…'}
        />

        <div className="grid grid-cols-2 gap-4">
          {/* Left: all available (filtered by mode + search) */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-content-secondary">
              Wszyscy
            </p>
            <div className="h-64 overflow-y-auto rounded-xl border border-border-subtle bg-surface-overlay">
              {sourceList.length === 0 ? (
                <p className="px-4 py-3 text-sm text-content-secondary">Brak wyników.</p>
              ) : (
                sourceList.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pick(p)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-content-secondary transition-colors hover:bg-surface-muted hover:text-content-primary"
                  >
                    <SkillIcon avg={p.average} />
                    <span className="truncate">{p.first_name} {p.last_name}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right: all selected (regardless of mode) */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-content-secondary">
              Wybrani
            </p>
            <div className="h-64 overflow-y-auto rounded-xl border border-border-subtle bg-surface-overlay">
              {selected.length === 0 ? (
                <p className="px-4 py-3 text-sm text-content-secondary">Brak wybranych.</p>
              ) : (
                selected.map(p => {
                  const displayName = [p.first_name, p.last_name].filter(Boolean).join(' ');
                  return (
                    <div key={p.id} className="flex items-center justify-between px-4 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <SkillIcon avg={p.average} />
                        <span className="truncate text-sm text-content-primary">{displayName}</span>
                        {p.cpu && <Badge variant="neutral" mono>Bot</Badge>}
                      </div>
                      <button
                        type="button"
                        onClick={() => unpick(p.id)}
                        className="ml-2 shrink-0 rounded p-1 text-content-secondary transition-colors hover:text-score-down-text"
                        aria-label="Usuń"
                      >×</button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
