import type { BracketMatch } from '../../types/bracket';
import { Button } from '../ui/Button';
import { PlayerHeader } from './LiveMatchScreen/PlayerHeader';

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
    <div className="fixed inset-0 z-50 flex select-none flex-col bg-surface-base">

      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-score-up" />
          <span className="text-xs font-medium uppercase tracking-widest text-content-secondary">
            Na żywo
          </span>
        </div>
        <Button variant="secondary" size="sm" onClick={onClose}>Zamknij</Button>
      </div>

      {/* Player headers — shared with LiveMatchScreen (no averages in viewer) */}
      <div className="flex shrink-0 border-b border-border-subtle">
        <PlayerHeader
          name={top.playerName ?? 'Gracz 1'}
          remaining={p0Remaining}
          legsWon={p0LegsWon}
          isActive={active === 0}
          align="left"
        />
        <div className="flex w-14 shrink-0 flex-col items-center justify-center gap-1 border-x border-border-subtle py-3">
          <span className="text-xs text-content-secondary">🎯</span>
        </div>
        <PlayerHeader
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
          <div key={i} className="flex items-center border-b border-border-subtle">

            <div className="flex flex-1 items-center justify-between px-3 py-2.5">
              {round.p0 && (
                <>
                  <span className="font-display text-xl font-bold tabular-nums text-content-primary">
                    {round.p0.score}
                  </span>
                  <span className="font-display text-xl tabular-nums text-content-secondary">
                    {round.p0.remaining}
                  </span>
                </>
              )}
            </div>

            <div className="flex w-14 shrink-0 items-center justify-center border-x border-border-subtle py-2.5">
              <span className="font-display text-base tabular-nums text-content-secondary">{(i + 1) * 3}</span>
            </div>

            <div className="flex flex-1 items-center justify-between px-3 py-2.5">
              {round.p1 && (
                <>
                  <span className="font-display text-xl tabular-nums text-content-secondary">
                    {round.p1.remaining}
                  </span>
                  <span className="font-display text-xl font-bold tabular-nums text-content-primary">
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
