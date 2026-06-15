export function PlayerHeader({
  name, remaining, legsWon, setsWon, legAvg, matchAvg, isActive, align, onClick,
}: {
  name: string; remaining: number; legsWon: number; setsWon?: number;
  legAvg: number; matchAvg: number;
  isActive: boolean; align: 'left' | 'right';
  onClick?: () => void;
}) {
  const scoreColor = isActive ? 'text-brand-white' : 'text-content-secondary';
  const scoreLabel = setsWon !== undefined ? `${setsWon} · ${legsWon}` : String(legsWon);
  const parts     = name.trim().split(' ');
  const lastName  = parts[parts.length - 1];
  const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
  return (
    <div
      onClick={onClick}
      className={[
        'flex flex-1 min-w-0 flex-col py-3 px-4 transition-colors duration-200',
        isActive ? 'bg-brand-purple/10' : 'opacity-60',
        onClick ? 'cursor-pointer hover:opacity-100 hover:bg-brand-purple/5' : '',
        align === 'right' ? 'items-end' : 'items-start',
      ].join(' ')}
    >
      <div className="flex w-full items-start justify-between gap-1">
        {align === 'right' ? (
          <>
            <span className="text-base font-bold tabular-nums text-brand-purple shrink-0">{scoreLabel}</span>
            <div className={['min-w-0 text-right', scoreColor].join(' ')}>
              {firstName && <div className="truncate text-sm font-medium tracking-wide leading-tight">{firstName}</div>}
              <div className="truncate text-base font-semibold tracking-wide leading-tight">{lastName}</div>
            </div>
          </>
        ) : (
          <>
            <div className={['min-w-0', scoreColor].join(' ')}>
              {firstName && <div className="truncate text-sm font-medium tracking-wide leading-tight">{firstName}</div>}
              <div className="truncate text-base font-semibold tracking-wide leading-tight">{lastName}</div>
            </div>
            <span className="text-base font-bold tabular-nums text-brand-purple shrink-0">{scoreLabel}</span>
          </>
        )}
      </div>
      <span className={[
        'text-6xl font-bold tabular-nums leading-tight mt-0.5 transition-colors',
        scoreColor,
      ].join(' ')}>
        {remaining}
      </span>
      {onClick && isActive && (
        <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-brand-purple">
          Zaczyna
        </span>
      )}
      <span className="text-lg tabular-nums font-semibold leading-tight mt-1 text-brand-purple">
        {legAvg > 0 ? legAvg.toFixed(1) : '—'}
      </span>
      <span className="text-sm tabular-nums text-content-secondary leading-tight">
        {matchAvg > 0 ? matchAvg.toFixed(1) : '—'}
      </span>
    </div>
  );
}
