import { useState } from 'react';
import type { Tournament } from '../../api/tournaments';
import { Input } from '../ui/Input';

type Props = {
  tournaments:  Tournament[];
  onSelect:     (tournament: Tournament) => void;
  placeholder?: string;
  limit?:       number;
};

export function TournamentSearchSelect({ tournaments, onSelect, placeholder, limit = 8 }: Props) {
  const [search, setSearch] = useState('');
  const filtered = tournaments.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col gap-2">
      <Input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={placeholder}
        autoFocus
      />
      {search && (
        <div className="max-h-44 overflow-y-auto rounded-lg border border-border-subtle bg-surface-overlay">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-content-secondary">Brak wyników.</p>
          ) : (
            filtered.slice(0, limit).map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => { onSelect(t); setSearch(''); }}
                className="w-full px-4 py-2.5 text-left text-sm text-content-secondary transition-colors hover:bg-surface-muted hover:text-content-primary"
              >
                {t.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
