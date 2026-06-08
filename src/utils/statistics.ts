import type { LegRecord, LegRound } from '../types/bracket';

export type PlayerMatchStats = {
  player_id?:       number | null;
  player_name:      string;
  match_id:         string;
  match_average:    number;
  count_180:        number;
  high_checkouts:   number;
  short_legs:       number;
  double_attempts:  number;
  double_hits:      number;
  darts_per_leg:    number;
};

function playerScores(rounds: LegRound[], idx: 0 | 1): number[] {
  const key = idx === 0 ? 'p0' : 'p1';
  return rounds.filter(r => r[key] !== undefined).map(r => r[key]!.score);
}

function avg(scores: number[]): number {
  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/** Average for the current (ongoing) leg — per visit, for one player. */
export function currentLegAvg(currentRounds: LegRound[], playerIdx: 0 | 1): number {
  return avg(playerScores(currentRounds, playerIdx));
}

/** Average across all completed legs + current leg rounds. */
export function matchAvg(completedLegs: LegRecord[], currentRounds: LegRound[], playerIdx: 0 | 1): number {
  const all: number[] = [];
  for (const leg of completedLegs) all.push(...playerScores(leg.rounds, playerIdx));
  all.push(...playerScores(currentRounds, playerIdx));
  return avg(all);
}

/** Full stats for both players after all legs are in completedLegs (current leg finished). */
export function computeMatchStats(
  matchId:       string,
  completedLegs: LegRecord[],
  playerNames:   [string, string],
  playerIds?:    [number | null, number | null],
): [PlayerMatchStats, PlayerMatchStats] {
  return [0, 1].map((i) => {
    const idx        = i as 0 | 1;
    const winnerKey  = idx === 0 ? 'top' : 'bottom';
    const allScores: number[] = [];
    let count180      = 0;
    let highCheckouts = 0;
    let shortLegs     = 0;
    let doubleAttempts = 0;
    let doubleHits     = 0;
    let dartsTotal     = 0;
    let legsWon        = 0;

    for (const leg of completedLegs) {
      const scores = playerScores(leg.rounds, idx);
      allScores.push(...scores);
      count180 += scores.filter(s => s === 180).length;

      for (const round of leg.rounds) {
        const entry = idx === 0 ? round.p0 : round.p1;
        if (entry?.doubleAttempt) {
          doubleAttempts += entry.doubleAttempt.dartsAtDouble;
        }
      }

      if (leg.winner === winnerKey) {
        const checkout = scores[scores.length - 1];
        if (checkout !== undefined && checkout >= 100) highCheckouts++;
        if (scores.length <= 5) shortLegs++;

        doubleHits++;
        legsWon++;

        const closingRoundIdx = leg.rounds.findIndex(r => {
          const e = idx === 0 ? r.p0 : r.p1;
          return e?.remaining === 0;
        });
        if (closingRoundIdx >= 0) {
          const closingEntry = idx === 0 ? leg.rounds[closingRoundIdx].p0 : leg.rounds[closingRoundIdx].p1;
          const dartsToClose = closingEntry?.doubleAttempt?.dartsToClose ?? 3;
          dartsTotal += closingRoundIdx * 3 + dartsToClose;
        }
      }
    }

    return {
      player_id:       playerIds?.[idx] ?? null,
      player_name:     playerNames[idx],
      match_id:        matchId,
      match_average:   avg(allScores),
      count_180:       count180,
      high_checkouts:  highCheckouts,
      short_legs:      shortLegs,
      double_attempts: doubleAttempts,
      double_hits:     doubleHits,
      darts_per_leg:   legsWon > 0 ? dartsTotal / legsWon : 0,
    };
  }) as [PlayerMatchStats, PlayerMatchStats];
}
