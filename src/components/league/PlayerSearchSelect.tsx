import { useState } from 'react';
import type { Player } from '../../types/player';
import { Input } from '../ui/Input';
import { SkillIcon } from '../ui/SkillIcon';

type Props = {
  players:     Player[];
  excludeIds:  Set<number>;
  onSelect:    (player: Player) => void;
  placeholder?: string;
  limit?:      number;
  autoFocus?:  boolean;
  /** Show each player's skill-tier medal next to the name. */
  showSkill?:  boolean;
};

export function PlayerSearchSelect({
  players, excludeIds, onSelect, placeholder, limit = 8, autoFocus, showSkill,
}: Props) {
  const [search, setSearch] = useState('');

  const filtered = players.filter(p =>
    !excludeIds.has(p.id) &&
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-2">
      <Input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
      {search && (
        <div className="max-h-44 overflow-y-auto rounded-lg border border-border-subtle bg-surface-overlay">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-content-secondary">Brak wyników.</p>
          ) : (
            filtered.slice(0, limit).map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => { onSelect(p); setSearch(''); }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-content-secondary transition-colors hover:bg-surface-muted hover:text-content-primary"
              >
                {showSkill && <SkillIcon avg={p.average} />}
                <span className="truncate">{p.first_name} {p.last_name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
