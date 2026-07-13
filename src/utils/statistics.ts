import type { LegRecord, LegRound } from '../types/bracket';
import type { StatisticRecord } from '../api/statistics';

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

export type PlayerRow = {
  player_name:    string;
  match_average:  number;
  count_180:      number;
  high_checkouts: number;
  short_legs:     number;
  matches:        number;
};

/**
 * Aggregates per-match statistic rows into one row per player, weighting the
 * average by matches played so far — this is the tournament-wide average
 * shown in the "Statystyki" tab, and the same figure the bracket cards should
 * show (rather than a player's static, tournament-agnostic profile average).
 */
export function aggregatePlayerStats(records: StatisticRecord[]): PlayerRow[] {
  const map = new Map<string, PlayerRow>();
  for (const r of records) {
    const existing = map.get(r.player_name);
    if (existing) {
      existing.match_average  = (existing.match_average * existing.matches + r.match_average) / (existing.matches + 1);
      existing.count_180      += r.count_180;
      existing.high_checkouts += r.high_checkouts;
      existing.short_legs     += r.short_legs;
      existing.matches        += 1;
    } else {
      map.set(r.player_name, { ...r, matches: 1 });
    }
  }
  return [...map.values()].sort((a, b) => b.match_average - a.match_average);
}

type Visit = { score: number; darts: number };

/**
 * A visit is always 3 darts, unless it's the throw that finished the leg
 * (remaining === 0) — that one took however many darts the double-attempt
 * modal recorded (dartsToClose), defaulting to 3 when that wasn't tracked.
 */
function playerVisits(rounds: LegRound[], idx: 0 | 1): Visit[] {
  const key = idx === 0 ? 'p0' : 'p1';
  return rounds
    .filter(r => r[key] !== undefined)
    .map(r => {
      const entry = r[key]!;
      const darts = entry.remaining === 0 ? (entry.doubleAttempt?.dartsToClose ?? 3) : 3;
      return { score: entry.score, darts };
    });
}

/** Standard 3-dart average: total points scored ÷ total darts thrown × 3. */
function avg(visits: Visit[]): number {
  const totalDarts = visits.reduce((s, v) => s + v.darts, 0);
  if (totalDarts === 0) return 0;
  const totalScore = visits.reduce((s, v) => s + v.score, 0);
  return (totalScore / totalDarts) * 3;
}

/** Average for the current (ongoing) leg — per visit, for one player. */
export function currentLegAvg(currentRounds: LegRound[], playerIdx: 0 | 1): number {
  return avg(playerVisits(currentRounds, playerIdx));
}

/** Average across all completed legs + current leg rounds. */
export function matchAvg(completedLegs: LegRecord[], currentRounds: LegRound[], playerIdx: 0 | 1): number {
  const all: Visit[] = [];
  for (const leg of completedLegs) all.push(...playerVisits(leg.rounds, playerIdx));
  all.push(...playerVisits(currentRounds, playerIdx));
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
    const allVisits: Visit[] = [];
    let count180      = 0;
    let highCheckouts = 0;
    let shortLegs     = 0;
    let doubleAttempts = 0;
    let doubleHits     = 0;
    let dartsTotal     = 0;
    let legsWon        = 0;

    for (const leg of completedLegs) {
      const visits = playerVisits(leg.rounds, idx);
      const scores = visits.map(v => v.score);
      allVisits.push(...visits);
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
      match_average:   avg(allVisits),
      count_180:       count180,
      high_checkouts:  highCheckouts,
      short_legs:      shortLegs,
      double_attempts: doubleAttempts,
      double_hits:     doubleHits,
      darts_per_leg:   legsWon > 0 ? dartsTotal / legsWon : 0,
    };
  }) as [PlayerMatchStats, PlayerMatchStats];
}
