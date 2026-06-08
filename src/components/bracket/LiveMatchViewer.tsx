import type { BracketMatch } from '../../types/bracket';

type Props = { match: BracketMatch; onClose: () => void };

const START = 501;

export function LiveMatchViewer({ match, onClose }: Props) {
  const { top, bottom } = match;
  const legs       = match.legs       ?? [];
  const currentLeg = match.currentLeg ?? { rounds: [], activePlayer: 0 as const };
  const rounds     = currentLeg.rounds;
  const active     = currentLeg.activePlayer;

  const p0Remaining = START - rounds.reduce((s, r) => s + (r.p0?.score ?? 0), 0);
  const p1Remaining = START - rounds.reduce((s, r) => s + (r.p1?.score ?? 0), 0);

  const p0LegsWon = legs.filter(l => l.winner === 'top').length;
  const p1LegsWon = legs.filter(l => l.winner === 'bottom').length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-brand-black select-none">

      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs font-medium uppercase tracking-widest text-content-secondary">
            Na żywo
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium text-content-secondary hover:text-brand-white transition-colors"
        >
          Zamknij
        </button>
      </div>

      {/* Player headers */}
      <div className="flex shrink-0 border-b border-border-subtle">
        <ViewerPlayerHeader
          name={top.playerName ?? 'Gracz 1'}
          remaining={p0Remaining}
          legsWon={p0LegsWon}
          isActive={active === 0}
          align="left"
        />
        <div className="w-14 shrink-0 border-x border-border-subtle flex flex-col items-center justify-center py-3 gap-1">
          <span className="text-xs text-content-secondary">🎯</span>
          <span className="text-xs tabular-nums font-bold text-brand-purple">
            {p0LegsWon}:{p1LegsWon}
          </span>
        </div>
        <ViewerPlayerHeader
          name={bottom.playerName ?? 'Gracz 2'}
          remaining={p1Remaining}
          legsWon={p1LegsWon}
          isActive={active === 1}
          align="right"
        />
      </div>

      {/* Scoreboard */}
      <div className="flex-1 overflow-y-auto">
        {rounds.map((round, i) => (
          <div key={i} className="flex items-center border-b border-border-subtle/20">

            <div className="flex flex-1 items-center justify-between px-3 py-2.5">
              {round.p0 && (
                <>
                  <span className="text-base font-semibold tabular-nums text-brand-white">
                    {round.p0.score}
                  </span>
                  <span className="text-base tabular-nums text-content-secondary">
                    {round.p0.remaining}
                  </span>
                </>
              )}
            </div>

            <div className="w-14 shrink-0 border-x border-border-subtle flex items-center justify-center py-2.5">
              <span className="text-sm tabular-nums text-content-secondary">{(i + 1) * 3}</span>
            </div>

            <div className="flex flex-1 items-center justify-between px-3 py-2.5">
              {round.p1 && (
                <>
                  <span className="text-base tabular-nums text-content-secondary">
                    {round.p1.remaining}
                  </span>
                  <span className="text-base font-semibold tabular-nums text-brand-white">
                    {round.p1.score}
                  </span>
                </>
              )}
            </div>

          </div>
        ))}

        {rounds.length === 0 && (
          <div className="flex flex-1 items-center justify-center py-16">
            <span className="text-xs text-content-secondary">Oczekiwanie na pierwszy rzut…</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ViewerPlayerHeader({
  name, remaining, legsWon, isActive, align,
}: {
  name: string; remaining: number; legsWon: number; isActive: boolean; align: 'left' | 'right';
}) {
  const scoreColor = isActive ? 'text-brand-white' : 'text-content-secondary';
  return (
    <div className={[
      'flex flex-1 flex-col py-3 px-4 transition-colors duration-200',
      isActive ? 'bg-brand-purple/10' : 'opacity-60',
      align === 'right' ? 'items-end' : 'items-start',
    ].join(' ')}>
      <div className="flex w-full items-center justify-between">
        {align === 'right' ? (
          <>
            <span className="text-sm font-bold tabular-nums text-brand-purple shrink-0">{legsWon}</span>
            <span className={['truncate text-sm font-semibold tracking-wide', scoreColor].join(' ')}>{name}</span>
          </>
        ) : (
          <>
            <span className={['truncate text-sm font-semibold tracking-wide', scoreColor].join(' ')}>{name}</span>
            <span className="text-sm font-bold tabular-nums text-brand-purple shrink-0">{legsWon}</span>
          </>
        )}
      </div>
      <span className={['text-5xl font-bold tabular-nums leading-tight mt-0.5', scoreColor].join(' ')}>
        {remaining}
      </span>
    </div>
  );
}
