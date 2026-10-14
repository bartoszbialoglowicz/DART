import { cn } from '../../ui/cn';
import { SkillIcon } from '../../ui/SkillIcon';

export function PlayerHeader({
  name, remaining, legsWon, setsWon, legAvg, matchAvg, isActive, align, onClick, avg,
}: {
  name: string; remaining: number; legsWon: number; setsWon?: number;
  /** Player's rating average — shows their skill-tier medal as a dimmed backdrop. */
  avg?: number | string | null;
  legAvg?: number; matchAvg?: number;
  isActive: boolean; align: 'left' | 'right';
  onClick?: () => void;
}) {
  const scoreColor = isActive ? 'text-content-primary' : 'text-content-secondary';
  const scoreLabel = setsWon !== undefined ? `${setsWon} · ${legsWon}` : String(legsWon);
  const parts     = name.trim().split(' ');
  const lastName  = parts[parts.length - 1];
  const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';

  return (
    <div
      onClick={onClick}
      className={cn(
        // isolate: the medal's -z-10 stays inside this header, above its own background.
        // @container: the remaining score scales with this panel's width.
        '@container relative isolate flex min-w-0 flex-1 flex-col overflow-hidden px-4 py-3 transition-colors',
        isActive ? 'bg-accent-soft' : 'opacity-60',
        onClick && 'cursor-pointer hover:bg-surface-muted hover:opacity-100',
        align === 'right' ? 'items-end' : 'items-start',
      )}
    >
      <SkillIcon
        avg={avg}
        size="xl"
        decorative
        fadeBottom
        className="pointer-events-none absolute left-1/2 top-0 -z-10 -translate-x-1/2 opacity-25"
      />

      <div className="flex w-full items-start justify-between gap-1">
        {align === 'right' ? (
          <>
            <span className="shrink-0 font-display text-base font-bold tabular-nums text-content-accent">{scoreLabel}</span>
            <div className={cn('min-w-0 text-right', scoreColor)}>
              {firstName && <div className="truncate text-sm font-medium leading-tight tracking-wide">{firstName}</div>}
              <div className="truncate text-base font-semibold leading-tight tracking-wide">{lastName}</div>
            </div>
          </>
        ) : (
          <>
            <div className={cn('min-w-0', scoreColor)}>
              {firstName && <div className="truncate text-sm font-medium leading-tight tracking-wide">{firstName}</div>}
              <div className="truncate text-base font-semibold leading-tight tracking-wide">{lastName}</div>
            </div>
            <span className="shrink-0 font-display text-base font-bold tabular-nums text-content-accent">{scoreLabel}</span>
          </>
        )}
      </div>

      <span className={cn(
        'mt-1 whitespace-nowrap font-display font-extrabold tabular-nums transition-all',
        isActive ? 'text-remaining' : 'text-remaining-idle',
        scoreColor,
      )}>
        {remaining}
      </span>

      {onClick && isActive && (
        <span className="mt-1 text-xs font-bold uppercase tracking-widest text-content-accent">
          Zaczyna
        </span>
      )}

      {legAvg !== undefined && (
        <span className="mt-1 font-display text-lg font-semibold tabular-nums leading-tight text-content-accent">
          {legAvg > 0 ? legAvg.toFixed(1) : '—'}
        </span>
      )}
      {matchAvg !== undefined && (
        <span className="font-display text-sm tabular-nums leading-tight text-content-secondary">
          {matchAvg > 0 ? matchAvg.toFixed(1) : '—'}
        </span>
      )}
    </div>
  );
}
