import { useTournamentStatistics } from '../../hooks/useTournaments';
import type { StatisticRecord } from '../../api/statistics';
import type { BracketData } from '../../types/bracket';
import { WinnerCard } from './WinnerCard';
import { cn } from '../ui/cn';

export type PlayerRow = {
  player_name:    string;
  match_average:  number;
  count_180:      number;
  high_checkouts: number;
  short_legs:     number;
  matches:        number;
};

function aggregate(records: StatisticRecord[]): PlayerRow[] {
  const map = new Map<string, PlayerRow>();
  for (const r of records) {
    const existing = map.get(r.player_name);
    if (existing) {
      existing.match_average  = (existing.match_average * existing.matches + r.match_average) / (existing.matches + 1);
      existing.count_180      += r.count_180;
      existing.high_checkouts += r.high_checkouts;
      existing.short_legs     += r.short_legs;
      existing.matches        += 1;
    } else {
      map.set(r.player_name, { ...r, matches: 1 });
    }
  }
  return [...map.values()].sort((a, b) => b.match_average - a.match_average);
}

export type Winner = { name: string; playerId: number | null };

function findWinner(bracket: BracketData): Winner | null {
  const rounds =
    bracket.format === 'knockout'
      ? bracket.rounds
      : bracket.playoff?.rounds ?? [];
  const lastRound = rounds[rounds.length - 1];
  if (!lastRound) return null;
  const final = lastRound.matches[0];
  if (!final?.result) return null;
  const slot = final.result.winner === 'top' ? final.top : final.bottom;
  if (!slot.playerName) return null;
  return { name: slot.playerName, playerId: slot.playerId };
}

type Props = {
  tournamentId: number;
  bracket:      BracketData;
  isActive:     boolean;
};

export function TournamentStats({ tournamentId, bracket, isActive }: Props) {
  const { data, isLoading } = useTournamentStatistics(tournamentId, isActive ? 5000 : undefined);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-content-secondary">Ładowanie...</span>
      </div>
    );
  }

  const rows       = aggregate(data ?? []);
  const isFinished = !isActive;
  const winner     = isFinished ? findWinner(bracket) : null;
  const winnerRow  = winner ? rows.find(r => r.player_name === winner.name) : undefined;

  const bracketInfo = [
    bracket.format === 'knockout' ? 'SKO' : 'Grupy',
    `${bracket.playerCount} graczy`,
    `BO${bracket.matchFormat.sets} set · BO${bracket.matchFormat.legs} leg`,
  ].join(' · ');

  return (
    <div className="flex-1 overflow-auto px-8 py-6 space-y-8">

      {/* Finished banner + winner card */}
      {isFinished && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border-subtle" />
            <span className="text-xs font-semibold uppercase tracking-widest text-content-secondary">
              Turniej zakończony
            </span>
            <div className="h-px flex-1 bg-border-subtle" />
          </div>

          {winner && (
            <div className="flex justify-center">
              <WinnerCard
                winner={winner}
                tournamentName={bracket.name}
                bracketInfo={bracketInfo}
                stats={winnerRow}
              />
            </div>
          )}
        </div>
      )}

      {/* Stats table */}
      {rows.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <span className="text-sm text-content-secondary">
            Brak danych — statystyki pojawią się po zakończeniu pierwszego lega.
          </span>
        </div>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-left">
              <th className="pb-3 pr-6 text-xs font-medium uppercase tracking-widest text-content-secondary">Gracz</th>
              <th className="pb-3 pr-6 text-right text-xs font-medium uppercase tracking-widest text-content-secondary">Mecze</th>
              <th className="pb-3 pr-6 text-right text-xs font-medium uppercase tracking-widest text-content-secondary">Średnia</th>
              <th className="pb-3 pr-6 text-right text-xs font-medium uppercase tracking-widest text-content-secondary">180</th>
              <th className="pb-3 pr-6 text-right text-xs font-medium uppercase tracking-widest text-content-secondary">100+</th>
              <th className="pb-3 text-right text-xs font-medium uppercase tracking-widest text-content-secondary">≤15 D</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.player_name}
                className={cn(
                  'border-b border-border-subtle',
                  i === 0 ? 'text-content-primary' : 'text-content-secondary',
                )}
              >
                <td className="py-3 pr-6 font-semibold">{row.player_name}</td>
                <td className="py-3 pr-6 text-right tabular-nums">{row.matches}</td>
                <td className="py-3 pr-6 text-right font-semibold tabular-nums text-content-accent">
                  {row.match_average > 0 ? row.match_average.toFixed(1) : '—'}
                </td>
                <td className="py-3 pr-6 text-right tabular-nums">{row.count_180      || '—'}</td>
                <td className="py-3 pr-6 text-right tabular-nums">{row.high_checkouts || '—'}</td>
                <td className="py-3 text-right tabular-nums">{row.short_legs      || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
