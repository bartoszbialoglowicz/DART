import type { BracketData, BracketMatch, Group, GroupStandingRow, LegRecord, MatchSlot } from '../types/bracket';
import type { MatchFormat } from '../types/tournament';

// The bracket itself is drawn and advanced by the server (tournaments/services);
// what's left here is presentation help and the wizard's phase preview.

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

export function allMatches(bracket: BracketData): BracketMatch[] {
  if (bracket.format === 'knockout') return bracket.rounds.flatMap(r => r.matches);
  return [
    ...bracket.groups.flatMap(g => g.matches ?? []),
    ...(bracket.playoff?.rounds.flatMap(r => r.matches) ?? []),
  ];
}

export function findMatch(bracket: BracketData | undefined, matchId: string | undefined): BracketMatch | null {
  if (!bracket || !matchId) return null;
  return allMatches(bracket).find(m => m.id === matchId) ?? null;
}

/** The format that applies to this match — the server resolves round/phase overrides. */
export function matchFormatOf(match: BracketMatch, bracket: BracketData): MatchFormat {
  return match.matchFormat ?? bracket.matchFormat;
}

/**
 * Score the server expects for a result: legs in a single-set match, sets
 * otherwise — the same number the result menu and displayScore use.
 */
export function headlineScore(
  result: { topSetsWon: number; bottomSetsWon: number },
  legs: LegRecord[],
  matchFormat: MatchFormat,
): { top: number; bottom: number } {
  if (matchFormat.sets === 1) {
    return {
      top:    legs.filter(l => l.winner === 'top').length,
      bottom: legs.filter(l => l.winner === 'bottom').length,
    };
  }
  return { top: result.topSetsWon, bottom: result.bottomSetsWon };
}

export function areGroupsComplete(groups: Group[]): boolean {
  return groups.length > 0 && groups.every(g =>
    (g.matches ?? []).length > 0
    && (g.matches ?? []).every(m => !!m.result || m.status === 'bye'),
  );
}

export type GroupStanding = GroupStandingRow & { slot: MatchSlot };

/** The server's group table, joined with each entry's slot for display. */
export function groupStandings(group: Group): GroupStanding[] {
  const slotByEntry = new Map(group.slots.filter(s => s.entryId != null).map(s => [s.entryId!, s]));
  return (group.standings ?? []).flatMap(row => {
    const slot = slotByEntry.get(row.entryId);
    return slot ? [{ ...row, slot }] : [];
  });
}
