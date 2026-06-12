import { client } from './client';
import type { BracketData, BracketMatch, CurrentLeg, LegRecord } from '../types/bracket';

export interface Tournament {
  id: number;
  name: string;
  format: string;
  bracket: BracketData;
  is_active: boolean;
  is_private: boolean;
  start_date: string | null;
  owner_username: string | null;
  created_at: string;
  updated_at: string;
}

// Shape returned by the server — bracket has no legs, legs are in match_legs
interface TournamentServer extends Tournament {
  match_legs: Record<string, { legs: LegRecord[]; currentLeg: CurrentLeg | null }>;
}

function mergeMatch(m: BracketMatch, ml: { legs: LegRecord[]; currentLeg: CurrentLeg | null } | undefined): BracketMatch {
  if (!ml) return m;
  return {
    ...m,
    ...(ml.legs?.length   ? { legs:       ml.legs       } : {}),
    ...(ml.currentLeg     ? { currentLeg: ml.currentLeg } : {}),
  };
}

function mergeLegsIntoBracket(raw: TournamentServer): Tournament {
  const { match_legs, ...rest } = raw;
  if (!match_legs || Object.keys(match_legs).length === 0) return rest;

  const merge = (m: BracketMatch) => mergeMatch(m, match_legs[m.id]);

  let bracket: BracketData = raw.bracket;
  if (bracket.format === 'knockout') {
    bracket = { ...bracket, rounds: bracket.rounds.map(r => ({ ...r, matches: r.matches.map(merge) })) };
  } else {
    bracket = {
      ...bracket,
      groups: bracket.groups.map(g => ({ ...g, matches: (g.matches ?? []).map(merge) })),
      playoff: bracket.playoff
        ? { rounds: bracket.playoff.rounds.map(r => ({ ...r, matches: r.matches.map(merge) })) }
        : undefined,
    };
  }
  return { ...rest, bracket };
}

function stripLegsFromBracket(bracket: BracketData): BracketData {
  const strip = ({ legs: _l, currentLeg: _c, ...m }: BracketMatch): BracketMatch => m;
  if (bracket.format === 'knockout') {
    return { ...bracket, rounds: bracket.rounds.map(r => ({ ...r, matches: r.matches.map(strip) })) };
  }
  return {
    ...bracket,
    groups: bracket.groups.map(g => ({ ...g, matches: (g.matches ?? []).map(strip) })),
    playoff: bracket.playoff
      ? { rounds: bracket.playoff.rounds.map(r => ({ ...r, matches: r.matches.map(strip) })) }
      : undefined,
  };
}

export const tournamentsApi = {
  list() {
    return client.get<{ results: TournamentServer[]; count: number }>('/tournaments/').then(res => ({
      ...res,
      results: res.results.map(mergeLegsIntoBracket),
    }));
  },

  detail(id: number) {
    return client.get<TournamentServer>(`/tournaments/${id}/`).then(mergeLegsIntoBracket);
  },

  create(bracket: BracketData, meta: { is_private: boolean; start_date: string | null }) {
    return client.post<TournamentServer>('/tournaments/', {
      name:       bracket.name,
      format:     bracket.format,
      bracket:    stripLegsFromBracket(bracket),
      is_private: meta.is_private,
      start_date: meta.start_date,
    }).then(mergeLegsIntoBracket);
  },

  update(id: number, bracket: BracketData) {
    return client.patch<TournamentServer>(`/tournaments/${id}/`, {
      bracket: stripLegsFromBracket(bracket),
    }).then(mergeLegsIntoBracket);
  },

  updateMatchLeg(id: number, matchId: string, legs: LegRecord[], currentLeg: CurrentLeg | null) {
    return client.put(`/tournaments/${id}/match-legs/${matchId}/`, { legs, currentLeg });
  },

  destroy(id: number) {
    return client.delete(`/tournaments/${id}/`);
  },
};
