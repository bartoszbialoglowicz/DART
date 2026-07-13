/*
 * WinnerCard — expressive champion poster.  ui-lint-disable-file
 *
 * SANCTIONED off-system component (approved exception). It intentionally
 * breaks the token rules: poster-scale micro-typography, custom letter
 * spacing, multi-stop decorative gradients, diagonal stripe background and
 * trophy gold (≈ the `rank` token, kept literal here for the gradients).
 *
 * Do NOT copy this opt-out into other files to silence the linter. Normal UI
 * uses tokens; only deliberate "art" pieces like this one are exempt, and
 * only with a human's sign-off.
 */
import { usePlayer } from '../../hooks/usePlayers';
import type { PlayerRow, Winner } from './TournamentStats';

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

export function WinnerCard({ winner, tournamentName, bracketInfo, stats }: {
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
