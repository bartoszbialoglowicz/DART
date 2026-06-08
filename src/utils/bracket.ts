import type { BracketData, BracketMatch, BracketRound, Group, GroupsBracketData, MatchResult, MatchSlot } from '../types/bracket';
import type { Player } from '../types/player';
import type { TournamentConfig } from '../types/tournament';
import { avgToSigma } from './dart501';

const ROUND_LABELS_FROM_END: Record<number, string> = {
  0: 'Finał',
  1: 'Półfinał',
  2: 'Ćwierćfinał',
};

function roundLabel(index: number, total: number): string {
  const fromEnd = total - 1 - index;
  return ROUND_LABELS_FROM_END[fromEnd] ?? `Runda ${index + 1}`;
}

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function playerSlot(player: Player | undefined): MatchSlot {
  if (!player) return { playerId: null, playerName: null, playerAvg: null, isCpu: false };
  const avg = parseFloat(player.average);
  return {
    playerId:   player.id,
    playerName: `${player.first_name} ${player.last_name}`,
    playerAvg:  avg,
    isCpu:      player.cpu,
    ...(player.cpu ? { cpuSigma: avgToSigma(avg) } : {}),
  };
}

function emptySlot(): MatchSlot {
  return { playerId: null, playerName: null, playerAvg: null, isCpu: false };
}

// ── Knockout ──────────────────────────────────────────────────────────────────

function generateKnockoutRounds(playerCount: number, players: Player[]): BracketRound[] {
  const seeded = shuffle(players);
  const numRounds = Math.log2(playerCount);
  return Array.from({ length: numRounds }, (_, roundIndex) => {
    const matchCount = playerCount / Math.pow(2, roundIndex + 1);
    return {
      id: `round-${roundIndex}`,
      label: roundLabel(roundIndex, numRounds),
      matches: Array.from({ length: matchCount }, (_, matchIndex) => ({
        id: `r${roundIndex}-m${matchIndex}`,
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

function generateGroupMatches(groupId: string, slots: MatchSlot[]): BracketMatch[] {
  const valid = slots.filter(s => s.playerId !== null);
  const matches: BracketMatch[] = [];
  let idx = 0;
  for (let i = 0; i < valid.length - 1; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      matches.push({ id: `${groupId}-m${idx++}`, top: valid[i], bottom: valid[j] });
    }
  }
  return matches;
}

function generateGroups(playerCount: number, players: Player[]): Group[] {
  const seeded = shuffle(players);
  const groupSize = 4;
  const groupCount = Math.ceil(playerCount / groupSize);
  return Array.from({ length: groupCount }, (_, i) => {
    const slots = Array.from({ length: groupSize }, (_, j) => playerSlot(seeded[i * groupSize + j]));
    return {
      id: `group-${i}`,
      label: String.fromCharCode(65 + i),
      slots,
      matches: generateGroupMatches(`group-${i}`, slots),
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

export function generatePlayoffFromGroups(groups: Group[]): BracketRound[] {
  const n = groups.length;
  const standings = groups.map(computeGroupStandings);

  // Cross-seed: A1 vs last-group runner-up, B1 vs second-to-last runner-up, etc.
  const seeds: MatchSlot[] = [];
  for (let i = 0; i < n; i++) {
    seeds.push(standings[i][0]?.slot             ?? emptySlot());
    seeds.push(standings[n - 1 - i][1]?.slot ?? emptySlot());
  }

  // Pad to next power of 2
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(seeds.length, 2))));
  while (seeds.length < bracketSize) seeds.push(emptySlot());

  const numRounds = Math.log2(bracketSize);
  return Array.from({ length: numRounds }, (_, ri) => {
    const matchCount = bracketSize / Math.pow(2, ri + 1);
    return {
      id: `r${ri}`,
      label: roundLabel(ri, numRounds),
      matches: Array.from({ length: matchCount }, (_, mi) => ({
        id: `r${ri}-m${mi}`,
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
  if (config.format === 'knockout') {
    return {
      format: 'knockout',
      name: config.name,
      playerCount: config.playerCount,
      matchFormat: config.matchFormat,
      rounds: generateKnockoutRounds(config.playerCount, config.players),
    };
  }
  return {
    format: 'groups',
    name: config.name,
    playerCount: config.playerCount,
    matchFormat: config.matchFormat,
    groups: generateGroups(config.playerCount, config.players),
  };
}
