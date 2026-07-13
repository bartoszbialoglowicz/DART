import { useState } from 'react';
import type { TournamentPlayer, TournamentFormat } from '../../types/tournament';
import { GROUP_SIZE_OPTIONS } from '../../types/tournament';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { OptionButton } from '../ui/OptionButton';
import { PlayerPickerModal } from './PlayerPickerModal';

type Props = {
  format:            TournamentFormat;
  groupSize:         number;
  onGroupSizeChange: (n: number) => void;
  entries:           TournamentPlayer[];
  onBulkSet:         (players: TournamentPlayer[]) => void;
  onAddPlaceholder:  (name: string) => void;
  onRemove:          (id: number) => void;
};

export function TournamentRosterStep({
  format, groupSize, onGroupSizeChange, entries, onBulkSet, onAddPlaceholder, onRemove,
}: Props) {
  const [pickerOpen, setPickerOpen]           = useState(false);
  const [placeholderName, setPlaceholderName] = useState('');

  const registeredEntries = entries.filter(e => e.id > 0);

  function handleAddPlaceholder() {
    if (!placeholderName.trim()) return;
    onAddPlaceholder(placeholderName.trim());
    setPlaceholderName('');
  }

  function handlePickerConfirm(players: TournamentPlayer[]) {
    onBulkSet(players);
    setPickerOpen(false);
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Group size — only for groups format */}
      {format === 'groups' && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-widest text-content-secondary">Rozmiar grupy</p>
          <div className="flex flex-wrap gap-2">
            {GROUP_SIZE_OPTIONS.map(n => (
              <OptionButton key={n} selected={groupSize === n} onClick={() => onGroupSizeChange(n)}>
                {n} graczy
              </OptionButton>
            ))}
          </div>
        </div>
      )}

      {/* Registered players + bots */}
      <div className="rounded-xl border border-border-subtle bg-surface-overlay p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-content-secondary">
            Zarejestrowani i boty
          </p>
          <Button variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
            Wybierz graczy
          </Button>
        </div>
        {registeredEntries.length > 0 && (
          <p className="mt-2 text-xs text-content-faint">
            {registeredEntries.length} {registeredEntries.length === 1 ? 'gracz wybrany' : 'graczy wybranych'}
          </p>
        )}
      </div>

      {/* Placeholder add */}
      <div className="rounded-xl border border-border-subtle bg-surface-overlay p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-content-secondary">
          Dodaj placeholder
        </p>
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              type="text"
              value={placeholderName}
              onChange={e => setPlaceholderName(e.target.value)}
              placeholder="Imię i nazwisko (np. Anna Kowalska)"
              onKeyDown={e => e.key === 'Enter' && handleAddPlaceholder()}
            />
          </div>
          <Button variant="primary" disabled={!placeholderName.trim()} onClick={handleAddPlaceholder}>
            Dodaj
          </Button>
        </div>
      </div>

      {/* All entries list */}
      {entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-content-secondary">
          Brak graczy. Dodaj co najmniej dwóch.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map(entry => {
            const isPlaceholder = entry.id < 0;
            const isCpu         = entry.cpu;
            const displayName   = [entry.first_name, entry.last_name].filter(Boolean).join(' ');
            return (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface-overlay px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-content-primary">{displayName}</span>
                  {isCpu        && <Badge variant="neutral" mono>Bot</Badge>}
                  {isPlaceholder && <Badge variant="rank"    mono>TBD</Badge>}
                  {!isPlaceholder && !isCpu && (
                    <span className="text-xs tabular-nums text-content-faint">
                      śr. {parseFloat(entry.average).toFixed(1)}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(entry.id)}
                  className="rounded p-1 text-content-secondary transition-colors hover:text-score-down-text"
                  aria-label="Usuń"
                >×</button>
              </div>
            );
          })}
        </div>
      )}

      {pickerOpen && (
        <PlayerPickerModal
          initialSelected={registeredEntries}
          onConfirm={handlePickerConfirm}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
