/*
 * WinnerCardBrand — VARIANT B (in-brand champion poster), test implementation.
 *
 * Sits alongside the original WinnerCard for comparison. Unlike the original,
 * this one stays on-system: every colour comes from a token (decorative
 * gradients use `color-mix(... var(--color-*) ...)`, never hex literals), the
 * name uses our display face (Saira Condensed) and auto-fits any length via
 * SVG textLength, the stat strip mirrors the <Stat> numeral, and there is a
 * photo-less fallback. Because nothing is off-system, it needs NO lint opt-out.
 *
 * Gold is demoted to a hairline + a small crown; purple is the hero accent.
 */
import { usePlayer } from '../../hooks/usePlayers';
import type { PlayerRow, Winner } from './TournamentStats';

export function WinnerCardBrand({ winner, tournamentName, bracketInfo, stats }: {
  winner:         Winner;
  tournamentName: string;
  bracketInfo:    string;
  stats:          PlayerRow | undefined;
}) {
  const { data: player } = usePlayer(winner.playerId ?? 0);
  const photoUrl = player?.winner_img ?? null;

  const parts = winner.name.trim().split(' ').filter(Boolean);
  const first = parts.slice(0, -1).join(' ').toUpperCase();
  const last  = (parts.length > 1 ? parts[parts.length - 1] : parts[0] ?? '').toUpperCase();
  const initials = ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();

  const statItems = [
    { value: stats?.match_average  ? stats.match_average.toFixed(1) : '—', label: 'Średnia' },
    { value: stats?.count_180      || '—', label: '180'   },
    { value: stats?.high_checkouts || '—', label: '100+'  },
    { value: stats?.short_legs     || '—', label: '≤15 D' },
  ];

  return (
    <div
      className="relative w-80 select-none overflow-hidden rounded-2xl border border-border-subtle bg-surface-base"
      style={{ height: 420 }}
    >
      {/* Base — subtle purple wash fading into the app black */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, color-mix(in srgb, var(--color-surface-accent) 14%, var(--color-surface-base)), var(--color-surface-base) 58%)' }}
      />

      {/* Purple halo glow, top-centre */}
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full"
        style={{
          width: '150%', height: '150%', top: '-108%',
          background: 'radial-gradient(circle, color-mix(in srgb, var(--color-surface-accent) 50%, transparent) 0%, color-mix(in srgb, var(--color-surface-accent) 16%, transparent) 42%, transparent 66%)',
        }}
      />

      {/* Player photo, or monogram fallback when there is none */}
      {photoUrl ? (
        <img src={photoUrl} alt={winner.name} className="absolute inset-0 h-full w-full object-contain object-bottom" />
      ) : (
        <div className="absolute inset-x-0 top-14 flex justify-center">
          <div className="flex h-32 w-32 items-center justify-center rounded-full border border-border-subtle bg-accent-soft">
            <span className="font-display text-5xl font-extrabold tracking-tight text-accent-text">{initials}</span>
          </div>
        </div>
      )}

      {/* Bottom legibility gradient toward the base black */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, transparent 38%, color-mix(in srgb, var(--color-surface-base) 72%, transparent) 62%, var(--color-surface-base) 92%)' }}
      />

      {/* Demoted gold — thin top hairline */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(to right, transparent, var(--color-rank) 50%, transparent)' }}
      />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-between p-5">

        {/* Top — crown + labels */}
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-xl leading-none text-rank-text" aria-hidden="true">♛</span>
          <p className="text-xs font-semibold uppercase tracking-widest text-content-faint">Zwycięzca</p>
          <p className="text-xs font-bold uppercase tracking-widest text-content-accent">{tournamentName}</p>
        </div>

        {/* Bottom — name + stats */}
        <div>
          <p className="mb-1 text-center text-xs font-medium uppercase tracking-widest text-content-faint">{bracketInfo}</p>

          <div className="text-center">
            {first && (
              <div className="font-display text-xl font-semibold uppercase leading-none tracking-wide text-content-secondary">
                {first}
              </div>
            )}
            <div className="mt-1 text-content-primary">
              <svg viewBox="0 0 300 56" className="block w-full" role="img" aria-label={last}>
                <text
                  x="150" y="46" textAnchor="middle"
                  textLength="296" lengthAdjust="spacingAndGlyphs"
                  className="font-display" fill="currentColor"
                  style={{ fontSize: 52, fontWeight: 800 }}
                >
                  {last}
                </text>
              </svg>
            </div>
            <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-content-accent" />
          </div>

          {/* Stat strip — numerals mirror <Stat> (display face, tabular) */}
          <div className="mt-4 flex items-center justify-between border-t border-border-subtle pt-4">
            {statItems.map(({ value, label }) => (
              <div key={label} className="flex flex-col items-center gap-0.5">
                <span className="font-display text-2xl font-extrabold leading-none tracking-tight tabular-nums text-content-primary">
                  {value}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-content-faint">{label}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
