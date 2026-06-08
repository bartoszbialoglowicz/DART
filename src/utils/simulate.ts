import type { LegRecord, LegRound, MatchResult, MatchSlot } from '../types/bracket';
import type { MatchFormat } from '../types/tournament';
import { avgToSigma, simulateCpuVisit } from './dart501';

export type MatchSimulationResult = {
  result: MatchResult;
  legs:   LegRecord[];
};

export function buildManualResult(
  topScore:    number,
  bottomScore: number,
  matchFormat: MatchFormat,
): MatchResult {
  const winner: 'top' | 'bottom' = topScore > bottomScore ? 'top' : 'bottom';

  if (matchFormat.sets === 1) {
    return {
      topSetsWon:    topScore > bottomScore ? 1 : 0,
      bottomSetsWon: topScore > bottomScore ? 0 : 1,
      displayScore:  `${topScore}–${bottomScore}`,
      winner,
    };
  }

  return {
    topSetsWon:    topScore,
    bottomSetsWon: bottomScore,
    displayScore:  `${topScore}–${bottomScore}`,
    winner,
  };
}

function simulateLeg(sigmaTop: number, sigmaBottom: number): LegRecord {
  let remTop    = 501;
  let remBottom = 501;
  const rounds: LegRound[] = [];

  for (let i = 0; i < 500; i++) {
    const topVisit = simulateCpuVisit(remTop, sigmaTop);
    remTop -= topVisit.totalScored;
    const round: LegRound = { p0: { score: topVisit.totalScored, remaining: remTop } };

    if (remTop === 0) {
      rounds.push(round);
      return { rounds, winner: 'top' };
    }

    const botVisit = simulateCpuVisit(remBottom, sigmaBottom);
    remBottom -= botVisit.totalScored;
    round.p1 = { score: botVisit.totalScored, remaining: remBottom };
    rounds.push(round);

    if (remBottom === 0) return { rounds, winner: 'bottom' };
  }

  return { rounds, winner: remTop <= remBottom ? 'top' : 'bottom' };
}

export function simulateMatch(
  top:         MatchSlot,
  bottom:      MatchSlot,
  matchFormat: MatchFormat,
): MatchSimulationResult {
  const sigmaTop    = avgToSigma(top.playerAvg    ?? 0);
  const sigmaBottom = avgToSigma(bottom.playerAvg ?? 0);

  const setsToWin = Math.ceil(matchFormat.sets / 2);
  const legsToWin = Math.ceil(matchFormat.legs / 2);

  let topSetsWon  = 0;
  let botSetsWon  = 0;
  let lastTopLegs = 0;
  let lastBotLegs = 0;
  const allLegs: LegRecord[] = [];

  while (topSetsWon < setsToWin && botSetsWon < setsToWin) {
    let topLegs = 0;
    let botLegs = 0;

    while (topLegs < legsToWin && botLegs < legsToWin) {
      const leg = simulateLeg(sigmaTop, sigmaBottom);
      allLegs.push(leg);
      if (leg.winner === 'top') topLegs++;
      else botLegs++;
    }

    lastTopLegs = topLegs;
    lastBotLegs = botLegs;

    if (topLegs >= legsToWin) topSetsWon++;
    else botSetsWon++;
  }

  const displayScore = matchFormat.sets === 1
    ? `${lastTopLegs}–${lastBotLegs}`
    : `${topSetsWon}–${botSetsWon}`;

  return {
    result: {
      topSetsWon,
      bottomSetsWon: botSetsWon,
      displayScore,
      winner: topSetsWon >= setsToWin ? 'top' : 'bottom',
    },
    legs: allLegs,
  };
}
