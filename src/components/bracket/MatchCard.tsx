import { useState } from 'react';
import type { BracketMatch, MatchSlot } from '../../types/bracket';
import type { MatchFormat } from '../../types/tournament';
import { cn } from '../ui/cn';
import { MatchActionMenu } from './MatchActionMenu';

type Props = {
  match:          BracketMatch;
  matchFormat:    MatchFormat;
  isOwner:        boolean;
  onSimulate?:    (matchId: string) => void;
  onEnterResult?: (matchId: string, topScore: number, bottomScore: number) => void;
};

export function MatchCard({ match, matchFormat, isOwner, onSimulate, onEnterResult }: Props) {
  const { top, bottom, result, legs } = match;
  const [menuOpen, setMenuOpen] = useState(false);

  const hasPlayers   = top.playerId !== null && bottom.playerId !== null;
  const isClickable  = hasPlayers && !result;

  const topIsWinner    = result?.winner === 'top';
  const bottomIsWinner = result?.winner === 'bottom';

  const topLegsWon    = legs?.filter(l => l.winner === 'top').length    ?? 0;
  const bottomLegsWon = legs?.filter(l => l.winner === 'bottom').length ?? 0;
  const isLive        = !result && (topLegsWon > 0 || bottomLegsWon > 0);

  return (
    <>
      <button
        type="button"
        onClick={() => isClickable && setMenuOpen(true)}
        disabled={!isClickable}
        className={cn(
          'w-40 overflow-hidden rounded-lg border border-border-subtle bg-surface-overlay text-left',
          isClickable ? 'cursor-pointer transition-colors hover:bg-surface-muted' : 'cursor-default',
        )}
      >
        <Slot slot={top}    winner={topIsWinner}    loser={result !== undefined && !topIsWinner} />

        {result ? (
          <div className="border-t border-border-subtle py-1 text-center font-display text-xs font-semibold tabular-nums text-content-accent">
            {result.displayScore}
          </div>
        ) : isLive ? (
          <div className="flex items-center justify-center gap-1.5 border-t border-border-subtle py-1">
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-score-up" />
            <span className="font-display text-xs font-semibold tabular-nums text-content-accent">
              {topLegsWon}–{bottomLegsWon}
            </span>
          </div>
        ) : (
          <div className="border-t border-border-subtle" />
        )}

        <Slot slot={bottom} winner={bottomIsWinner} loser={result !== undefined && !bottomIsWinner} />
      </button>

      {menuOpen && (
        <MatchActionMenu
          match={match}
          matchFormat={matchFormat}
          isOwner={isOwner}
          onSimulate={onSimulate}
          onEnterResult={onEnterResult}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </>
  );
}

function Slot({ slot, winner, loser }: { slot: MatchSlot; winner: boolean; loser: boolean }) {
  return (
    <div
      className={cn(
        'flex h-9 min-w-0 items-center gap-1 px-3 text-xs transition-colors',
        winner && 'font-semibold text-content-primary',
        loser && 'text-content-secondary opacity-40',
        !winner && !loser && 'text-content-secondary',
      )}
    >
      <span className="truncate">
        {slot.playerName ?? (slot.playerId !== null
          ? `Gracz ${slot.playerId}`
          : <span className="opacity-40">—</span>)}
      </span>
      {slot.playerAvg !== null && slot.playerAvg > 0 && (
        <span className="shrink-0 opacity-50">({slot.playerAvg.toFixed(1)})</span>
      )}
    </div>
  );
}
