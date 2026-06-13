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
  return (
    <div
      onClick={onClick}
      className={[
        'flex flex-1 flex-col py-3 px-4 transition-colors duration-200',
        isActive ? 'bg-brand-purple/10' : 'opacity-60',
        onClick ? 'cursor-pointer hover:opacity-100 hover:bg-brand-purple/5' : '',
        align === 'right' ? 'items-end' : 'items-start',
      ].join(' ')}
    >
      <div className="flex w-full items-center justify-between">
        {align === 'right' ? (
          <>
            <span className="text-sm font-bold tabular-nums text-brand-purple shrink-0">{scoreLabel}</span>
            <span className={['truncate text-sm font-semibold tracking-wide', scoreColor].join(' ')}>{name}</span>
          </>
        ) : (
          <>
            <span className={['truncate text-sm font-semibold tracking-wide', scoreColor].join(' ')}>{name}</span>
            <span className="text-sm font-bold tabular-nums text-brand-purple shrink-0">{scoreLabel}</span>
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
      <span className="text-base tabular-nums font-semibold leading-tight mt-1 text-brand-purple">
        {legAvg > 0 ? legAvg.toFixed(1) : '—'}
      </span>
      <span className="text-xs tabular-nums text-content-secondary leading-tight">
        {matchAvg > 0 ? matchAvg.toFixed(1) : '—'}
      </span>
    </div>
  );
}
