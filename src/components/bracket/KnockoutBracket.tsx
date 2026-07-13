import { Fragment } from 'react';
import type { BracketRound } from '../../types/bracket';
import type { MatchFormat } from '../../types/tournament';
import { MatchCard } from './MatchCard';

/*
 * Layout uses `justify-content: space-around` on each round column.
 * With space-around, the center of match i in a round with N matches is:
 *   center(i, N) = (i + 0.5) * (totalHeight / N)
 *
 * This means pair midpoints automatically align with the next-round match centers,
 * so connector calculations are purely arithmetic—no DOM measurements needed.
 */

const ROUND_WIDTH     = 160; // px — match card width
const CONNECTOR_WIDTH = 48;  // px — space for bracket lines between rounds
const SLOT_SIZE       = 88;  // px — height allocated per match in round 1

type Props = {
  rounds:         BracketRound[];
  matchFormat:    MatchFormat;
  isOwner:        boolean;
  avgByName?:     Map<string, number>;
  onSimulate?:    (matchId: string) => void;
  onEnterResult?: (matchId: string, topScore: number, bottomScore: number) => void;
};

export function KnockoutBracket({ rounds, matchFormat, isOwner, avgByName, onSimulate, onEnterResult }: Props) {
  // Height is derived from first-round match count to accommodate byes in non-power-of-2 brackets.
  const totalHeight = (rounds[0]?.matches.length ?? 1) * 2 * SLOT_SIZE;

  return (
    <div className="overflow-auto p-8">
      {/* Round labels row */}
      <div className="mb-4 flex">
        {rounds.map((round, i) => {
          const roundFormat = round.matchFormat ?? matchFormat;
          return (
            <Fragment key={round.id}>
              <div className="text-center" style={{ width: ROUND_WIDTH }}>
                <p className="text-xs font-semibold uppercase tracking-widest text-content-accent">
                  {round.label}
                </p>
                <p className="mt-0.5 text-xs text-content-secondary">
                  BO{roundFormat.sets} set · BO{roundFormat.legs} leg
                </p>
              </div>
              {i < rounds.length - 1 && <div style={{ width: CONNECTOR_WIDTH }} />}
            </Fragment>
          );
        })}
      </div>

      {/* Bracket body */}
      <div className="flex" style={{ height: totalHeight }}>
        {rounds.map((round, i) => (
          <Fragment key={round.id}>
            {/* Round column */}
            <div
              className="flex flex-col"
              style={{ width: ROUND_WIDTH, height: totalHeight, justifyContent: 'space-around' }}
            >
              {round.matches.map(match => (
                <MatchCard key={match.id} match={match} matchFormat={round.matchFormat ?? matchFormat} isOwner={isOwner} avgByName={avgByName} onSimulate={onSimulate} onEnterResult={onEnterResult} />
              ))}
            </div>

            {/* Connector column */}
            {i < rounds.length - 1 && (
              <ConnectorColumn
                matchCount={round.matches.length}
                totalHeight={totalHeight}
              />
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

type ConnectorProps = {
  matchCount: number;
  totalHeight: number;
};

function ConnectorColumn({ matchCount, totalHeight }: ConnectorProps) {
  const slotSize  = totalHeight / matchCount;
  const pairCount = matchCount / 2;
  const half      = CONNECTOR_WIDTH / 2;

  return (
    <div className="relative flex-shrink-0" style={{ width: CONNECTOR_WIDTH, height: totalHeight }}>
      {Array.from({ length: pairCount }, (_, i) => {
        const topY = (2 * i + 0.5) * slotSize;
        const botY = (2 * i + 1.5) * slotSize;
        const midY = (topY + botY) / 2;

        return (
          <Fragment key={i}>
            {/* arm from top match — centered on topY */}
            <HLine y={topY} left={0}      width={half} />
            {/* vertical spine — starts at topY, ends at botY */}
            <VLine x={half - 1} from={topY} to={botY} />
            {/* arm from bottom match — centered on botY */}
            <HLine y={botY} left={0}      width={half} />
            {/* arm to next round — centered on midY */}
            <HLine y={midY} left={half}   width={half} />
          </Fragment>
        );
      })}
    </div>
  );
}

function HLine({ y, left, width }: { y: number; left: number; width: number }) {
  return (
    <div className="absolute bg-border-subtle" style={{ top: y - 1, left, width, height: 2 }} />
  );
}

function VLine({ x, from, to }: { x: number; from: number; to: number }) {
  return (
    <div className="absolute bg-border-subtle" style={{ top: from, left: x, width: 2, height: to - from }} />
  );
}
