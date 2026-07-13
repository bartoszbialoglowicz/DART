import type { StandingsRow } from '../../types/league';
import { PendingBadge, EmptyMsg } from './shared';
import { cn } from '../ui/cn';

export function StandingsTab({ rows, scoreLabel }: { rows: StandingsRow[]; scoreLabel: string }) {
  if (rows.length === 0) {
    return <EmptyMsg>Brak danych do tabeli. Wpisz wyniki meczów w zakładce Terminarz.</EmptyMsg>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border-subtle">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-subtle text-xs uppercase tracking-widest text-content-secondary">
            <th className="w-8 px-4 py-3 text-left">#</th>
            <th className="px-4 py-3 text-left">Gracz</th>
            <th className="px-3 py-3 text-center">M</th>
            <th className="px-3 py-3 text-center">W</th>
            <th className="px-3 py-3 text-center">R</th>
            <th className="px-3 py-3 text-center">P</th>
            <th className="px-3 py-3 text-center">{scoreLabel}</th>
            <th className="px-4 py-3 text-center font-bold">Pkt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr
              key={row.member_id}
              className="border-b border-border-subtle transition-colors last:border-0 hover:bg-surface-muted"
            >
              <td className={cn(
                'px-4 py-3 tabular-nums',
                row.position === 1 ? 'font-bold text-rank-text' : 'text-content-secondary',
              )}>
                {row.position}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-content-primary">{row.display_name}</span>
                  {row.status === 'pending' && <PendingBadge />}
                </div>
              </td>
              <td className="px-3 py-3 text-center tabular-nums text-content-secondary">{row.played}</td>
              <td className="px-3 py-3 text-center tabular-nums text-score-up-text">{row.won}</td>
              <td className="px-3 py-3 text-center tabular-nums text-content-secondary">{row.drawn}</td>
              <td className="px-3 py-3 text-center tabular-nums text-score-down-text">{row.lost}</td>
              <td className="px-3 py-3 text-center tabular-nums text-content-secondary">
                {row.score_for}-{row.score_against}
              </td>
              <td className="px-4 py-3 text-center font-bold tabular-nums text-content-primary">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
