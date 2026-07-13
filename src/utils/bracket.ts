import type { BracketData, BracketMatch, BracketRound, Group, GroupsBracketData, MatchResult, MatchSlot } from '../types/bracket';
import type { PhaseConfig, TournamentConfig, TournamentPlayer } from '../types/tournament';
import { avgToSigma } from './dart501';

export const ROUND_LABELS_FROM_END: Record<number, string> = {
  0: 'Finał',
  1: 'Półfinał',
  2: 'Ćwierćfinał',
};

export function roundLabel(index: number, total: number): string {
  const fromEnd = total - 1 - index;
  return ROUND_LABELS_FROM_END[fromEnd] ?? `Runda ${index + 1}`;
}

export function nextPowerOf2(n: number): number {
  return Math.pow(2, Math.ceil(Math.log2(Math.max(n, 2))));
}

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function playerSlot(player: TournamentPlayer | undefined): MatchSlot {
  if (!player) return { playerId: null, playerName: null, playerAvg: null, isCpu: false };
  const avg = parseFloat(player.average);
  return {
    playerId:   player.id,
    playerName: [player.first_name, player.last_name].filter(Boolean).join(' '),
    playerAvg:  avg,
    isCpu:      player.cpu,
    ...(player.cpu ? { cpuSigma: avgToSigma(avg) } : {}),
  };
}

function emptySlot(): MatchSlot {
  return { playerId: null, playerName: null, playerAvg: null, isCpu: false };
}

// ── Knockout ──────────────────────────────────────────────────────────────────

function generateKnockoutRounds(
  players: TournamentPlayer[],
  phaseConfigs: Record<string, PhaseConfig>,
): BracketRound[] {
  const seeded = shuffle(players);
  const bracketSize = nextPowerOf2(players.length);
  const numRounds   = Math.log2(bracketSize);
  return Array.from({ length: numRounds }, (_, roundIndex) => {
    const matchCount = bracketSize / Math.pow(2, roundIndex + 1);
    const roundId    = `round-${roundIndex}`;
    const pc         = phaseConfigs[roundId];
    return {
      id:    roundId,
      label: roundLabel(roundIndex, numRounds),
      ...(pc?.date        && { date:        pc.date }),
      ...(pc?.matchFormat && { matchFormat: pc.matchFormat }),
      matches: Array.from({ length: matchCount }, (_, matchIndex) => ({
        id:     `r${roundIndex}-m${matchIndex}`,
        top:    roundIndex === 0 ? playerSlot(seeded[matchIndex * 2])     : emptySlot(),
        bottom: roundIndex === 0 ? playerSlot(seeded[matchIndex * 2 + 1]) : emptySlot(),
      })),
    };
  });
}

function applyResultInRounds(rounds: BracketRound[], matchId: string, result: MatchResult): BracketRound[] {
  const [rPart, mPart] = matchId.split('-');
  const roundIndex = parseInt(rPart.slice(1));
  const matchIndex = parseInt(mPart.slice(1));
  const match = rounds[roundIndex]?.matches[matchIndex];
  if (!match) return rounds;
  const winner     = result.winner === 'top' ? match.top : match.bottom;
  const nextRound  = roundIndex + 1;
  const hasNext    = nextRound < rounds.length;
  const nextMatch  = Math.floor(matchIndex / 2);
  const winnerSlot = matchIndex % 2 === 0 ? 'top' : 'bottom';
  return rounds.map((round, ri) => {
    if (ri === roundIndex) {
      return { ...round, matches: round.matches.map((m, mi) => mi === matchIndex ? { ...m, result } : m) };
    }
    if (hasNext && ri === nextRound) {
      return { ...round, matches: round.matches.map((m, mi) => mi === nextMatch ? { ...m, [winnerSlot]: winner } : m) };
    }
    return round;
  });
}

type KnockoutBracket = Extract<BracketData, { format: 'knockout' }>;

export function applyResult(b: KnockoutBracket, matchId: string, result: MatchResult): KnockoutBracket {
  return { ...b, rounds: applyResultInRounds(b.rounds, matchId, result) };
}


// ── Groups ────────────────────────────────────────────────────────────────────

/**
 * Predefined match order per group size — interleaved so no player plays
 * back-to-back more than once (impossible to fully avoid for 3-player groups).
 *
 * Indices are 0-based positions within the valid slots array.
 * 3 players:  1-3, 2-3, 1-2
 * 4 players:  1-3, 2-4, 1-4, 2-3, 1-2, 3-4
 * 5 players:  hand-crafted schedule with maximal spacing
 */
const GROUP_MATCH_ORDER: Record<number, [number, number][]> = {
  3: [[0,2],[1,2],[0,1]],
  4: [[0,2],[1,3],[0,3],[1,2],[0,1],[2,3]],
  5: [[0,2],[1,3],[0,4],[2,3],[1,4],[0,3],[2,4],[0,1],[3,4],[1,2]],
};

function generateGroupMatches(groupId: string, slots: MatchSlot[]): BracketMatch[] {
  const valid = slots.filter(s => s.playerId !== null);
  const n     = valid.length;
  const order = GROUP_MATCH_ORDER[n];

  if (order) {
    return order.map(([i, j], idx) => ({
      id:     `${groupId}-m${idx}`,
      top:    valid[i],
      bottom: valid[j],
    }));
  }

  // Fallback for unexpected group sizes — plain round-robin
  const matches: BracketMatch[] = [];
  let idx = 0;
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      matches.push({ id: `${groupId}-m${idx++}`, top: valid[i], bottom: valid[j] });
    }
  }
  return matches;
}

function generateGroups(players: TournamentPlayer[], groupSize: number, boardCount?: number | null): Group[] {
  const seeded     = shuffle(players);
  const groupCount = Math.max(1, Math.ceil(players.length / groupSize));
  return Array.from({ length: groupCount }, (_, i) => {
    const groupPlayers = seeded.slice(i * groupSize, (i + 1) * groupSize);
    const slots = Array.from({ length: groupSize }, (_, j) => playerSlot(groupPlayers[j]));
    const board = boardCount ? (i % boardCount) + 1 : undefined;
    return {
      id:      `group-${i}`,
      label:   String.fromCharCode(65 + i),
      slots,
      matches: generateGroupMatches(`group-${i}`, slots),
      ...(board !== undefined && { board }),
    };
  });
}

export type GroupStanding = {
  slot:         MatchSlot;
  played:       number;
  wins:         number;
  losses:       number;
  legsFor:      number;
  legsAgainst:  number;
  points:       number;
};

export function computeGroupStandings(group: Group): GroupStanding[] {
  const map = new Map<number, GroupStanding>();
  for (const slot of group.slots.filter(s => s.playerId !== null)) {
    map.set(slot.playerId!, { slot, played: 0, wins: 0, losses: 0, legsFor: 0, legsAgainst: 0, points: 0 });
  }
  for (const match of (group.matches ?? [])) {
    if (!match.result) continue;
    const t = match.top.playerId    !== null ? map.get(match.top.playerId)    : undefined;
    const b = match.bottom.playerId !== null ? map.get(match.bottom.playerId) : undefined;
    const tLegs = match.result.topSetsWon;
    const bLegs = match.result.bottomSetsWon;
    if (t) {
      t.played++; t.legsFor += tLegs; t.legsAgainst += bLegs;
      if (match.result.winner === 'top') { t.wins++; t.points += 2; } else t.losses++;
    }
    if (b) {
      b.played++; b.legsFor += bLegs; b.legsAgainst += tLegs;
      if (match.result.winner === 'bottom') { b.wins++; b.points += 2; } else b.losses++;
    }
  }
  return [...map.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const da = a.legsFor - a.legsAgainst, db = b.legsFor - b.legsAgainst;
    if (db !== da) return db - da;
    return b.legsFor - a.legsFor;
  });
}

export function areGroupsComplete(groups: Group[]): boolean {
  return groups.length > 0 && groups.every(g => (g.matches ?? []).length > 0 && (g.matches ?? []).every(m => !!m.result));
}

export function applyGroupMatchResult(b: GroupsBracketData, groupId: string, matchId: string, result: MatchResult): GroupsBracketData {
  return {
    ...b,
    groups: b.groups.map(g =>
      g.id !== groupId ? g : {
        ...g,
        matches: (g.matches ?? []).map(m => m.id === matchId ? { ...m, result } : m),
      }
    ),
  };
}

export function generatePlayoffFromGroups(
  groups: Group[],
  phaseConfigs: Record<string, PhaseConfig> = {},
): BracketRound[] {
  const n = groups.length;
  const standings = groups.map(computeGroupStandings);

  // Cross-seed: A1 vs last-group runner-up, B1 vs second-to-last runner-up, etc.
  const seeds: MatchSlot[] = [];
  for (let i = 0; i < n; i++) {
    seeds.push(standings[i][0]?.slot             ?? emptySlot());
    seeds.push(standings[n - 1 - i][1]?.slot ?? emptySlot());
  }

  // Pad to next power of 2
  const bracketSize = nextPowerOf2(Math.max(seeds.length, 2));
  while (seeds.length < bracketSize) seeds.push(emptySlot());

  const numRounds = Math.log2(bracketSize);
  return Array.from({ length: numRounds }, (_, ri) => {
    const matchCount = bracketSize / Math.pow(2, ri + 1);
    const roundId    = `r${ri}`;
    const pc         = phaseConfigs[roundId];
    return {
      id:    roundId,
      label: roundLabel(ri, numRounds),
      ...(pc?.date        && { date:        pc.date }),
      ...(pc?.matchFormat && { matchFormat: pc.matchFormat }),
      matches: Array.from({ length: matchCount }, (_, mi) => ({
        id:     `r${ri}-m${mi}`,
        top:    ri === 0 ? seeds[mi * 2]     : emptySlot(),
        bottom: ri === 0 ? seeds[mi * 2 + 1] : emptySlot(),
      })),
    };
  });
}


export function applyPlayoffResult(b: GroupsBracketData, matchId: string, result: MatchResult): GroupsBracketData {
  if (!b.playoff) return b;
  return { ...b, playoff: { rounds: applyResultInRounds(b.playoff.rounds, matchId, result) } };
}

// ── Generator ─────────────────────────────────────────────────────────────────

export function generateBracket(config: TournamentConfig): BracketData {
  const playerCount   = config.players.length;
  const phaseConfigs  = config.phaseConfigs ?? {};
  const hasPhases     = Object.keys(phaseConfigs).length > 0;

  if (config.format === 'knockout') {
    return {
      format:      'knockout',
      name:        config.name,
      playerCount,
      matchFormat: config.matchFormat,
      ...(hasPhases && { phaseConfigs }),
      rounds: generateKnockoutRounds(config.players, phaseConfigs),
    };
  }

  // groups — use group-stage format if configured, otherwise default
  const groupPhaseFormat = phaseConfigs['groups']?.matchFormat ?? config.matchFormat;
  const boardCount = config.venue_board_count ?? null;

  return {
    format:      'groups',
    name:        config.name,
    playerCount,
    matchFormat: groupPhaseFormat,
    ...(hasPhases   && { phaseConfigs }),
    ...(boardCount  && { board_count: boardCount }),
    groups: generateGroups(config.players, config.groupSize, boardCount),
  };
}
