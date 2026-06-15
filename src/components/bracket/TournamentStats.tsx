import { useTournamentStatistics } from '../../hooks/useTournaments';
import { usePlayer } from '../../hooks/usePlayers';
import type { StatisticRecord } from '../../api/statistics';
import type { BracketData } from '../../types/bracket';

type PlayerRow = {
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

type Winner = { name: string; playerId: number | null };

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

const AMBER = '#F59E0B';
const CARD_BG = '#080d1e';
const STRIPE_BG = '#0c1228';

function nameSizes(last: string): { last: string; first: string } {
  const n = last.length;
  if (n <= 7)  return { last: '3.0rem', first: '2.0rem' };
  if (n <= 10) return { last: '2.5rem', first: '1.65rem' };
  if (n <= 13) return { last: '2.0rem', first: '1.35rem' };
  return               { last: '1.6rem', first: '1.1rem' };
}

function WinnerCard({ winner, tournamentName, bracketInfo, stats }: {
  winner:         Winner;
  tournamentName: string;
  bracketInfo:    string;
  stats:          PlayerRow | undefined;
}) {
  const { data: player } = usePlayer(winner.playerId ?? 0);
  const photoUrl = player?.winner_img ?? null;

  const parts = winner.name.trim().split(' ');
  const first = parts.slice(0, -1).join(' ').toUpperCase() || '';
  const last  = (parts.length > 1 ? parts[parts.length - 1] : parts[0]).toUpperCase();

  const statItems = [
    { value: stats?.match_average  ? stats.match_average.toFixed(1) : '—', label: 'Średnia'  },
    { value: stats?.count_180      || '—', label: '180'    },
    { value: stats?.high_checkouts || '—', label: '100+'   },
    { value: stats?.short_legs     || '—', label: '≤15 D'  },
  ];

  return (
    <div className="w-80 rounded-2xl relative overflow-hidden select-none" style={{ height: 420 }}>

      {/* Layer 1 — diagonal stripe background (always base) */}
      <div
        className="absolute inset-0"
        style={{
          background: `repeating-linear-gradient(135deg, ${CARD_BG} 0px, ${CARD_BG} 12px, ${STRIPE_BG} 12px, ${STRIPE_BG} 24px)`,
        }}
      />

      {/* Layer 2 — player photo with cut-out background sits on top of stripes */}
      {photoUrl && (
        <img
          src={photoUrl}
          alt={winner.name}
          className="absolute inset-0 w-full h-full object-contain object-bottom"
        />
      )}

      {/* Layer 3 — dark gradient for text legibility at bottom */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 40%, rgba(0,0,0,0.8) 68%, rgba(0,0,0,0.97) 100%)',
        }}
      />

      {/* Layer 4 — gold crown halo just above top edge */}
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full"
        style={{
          width: '160%',
          height: '170%',
          top: '-125%',
          background: 'radial-gradient(circle, rgba(245,158,11,0.55) 0%, rgba(245,158,11,0.18) 40%, transparent 65%)',
        }}
      />
      {/* Thin amber highlight line at top edge */}
      <div
        className="pointer-events-none absolute top-0 inset-x-0 h-px"
        style={{ background: 'linear-gradient(to right, transparent, rgba(245,158,11,0.9) 40%, rgba(255,255,255,0.6) 50%, rgba(245,158,11,0.9) 60%, transparent)' }}
      />

      {/* Content — sits on top of all layers */}
      <div className="absolute inset-0 flex flex-col justify-between pt-5 px-5 pb-0">

        {/* Top labels */}
        <div>
          <p className="text-[8px] font-semibold uppercase tracking-[0.35em] text-white/40">
            Zwycięzca
          </p>
          <p className="mt-0.5 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: AMBER }}>
            {tournamentName}
          </p>
        </div>

        {/* Player name + stats */}
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/40 mb-1">
            {bracketInfo}
          </p>

          <div className="leading-[0.88]">
            {first && (
              <div className="font-black uppercase tracking-tight text-white" style={{ fontSize: nameSizes(last).first }}>
                {first}
              </div>
            )}
            <div className="font-black uppercase tracking-tight" style={{ fontSize: nameSizes(last).last, color: AMBER }}>
              {last}
            </div>
          </div>

          {/* Stats strip */}
          <div
            className="flex justify-between items-center mt-3 py-4"
            style={{ borderTop: '1px solid rgba(255,255,255,0.25)' }}
          >
            {statItems.map(({ value, label }) => (
              <div key={label} className="flex flex-col items-center">
                <div className="text-xl font-black tabular-nums text-white leading-none">{value}</div>
                <div className="text-[9px] font-semibold uppercase mt-0.5" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
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
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-content-secondary">
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
                className={[
                  'border-b border-border-subtle/30',
                  i === 0 ? 'text-brand-white' : 'text-content-secondary',
                ].join(' ')}
              >
                <td className="py-3 pr-6 font-semibold">{row.player_name}</td>
                <td className="py-3 pr-6 text-right tabular-nums">{row.matches}</td>
                <td className="py-3 pr-6 text-right tabular-nums font-semibold text-brand-purple">
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
