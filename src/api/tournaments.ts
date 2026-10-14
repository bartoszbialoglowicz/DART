import { client } from './client';
import type { BracketData, CurrentLeg, LegRecord } from '../types/bracket';
import type { MatchFormat, PhaseConfig, TournamentFormat } from '../types/tournament';

/** List row — no bracket. */
export interface TournamentSummary {
  id: number;
  name: string;
  format: string;
  is_active: boolean;
  bracket_confirmed: boolean;
  is_private: boolean;
  start_date: string | null;
  owner_username: string | null;
  player_count: number;
  created_at: string;
  updated_at: string;
}

/** Detail — the bracket is built by the server from the tournament's matches. */
export interface Tournament extends TournamentSummary {
  bracket: BracketData;
}

/** A roster line: an existing player, or a guest known only by name. */
export type TournamentEntryInput = { player_id: number } | { name: string };

export type CreateTournamentInput = {
  name:          string;
  format:        TournamentFormat;
  is_private:    boolean;
  start_date:    string | null;
  match_format:  MatchFormat;
  group_size:    number;
  phase_configs: Record<string, PhaseConfig>;
  board_count:   number | null;
  entries:       TournamentEntryInput[];
};

export type MatchResultInput = {
  top_score:    number;
  bottom_score: number;
  legs?:        LegRecord[];
  /** From the live-scoring screen — atomically releases its own live-leg lock. */
  live?:        boolean;
};

export const tournamentsApi = {
  list() {
    return client.get<{ results: TournamentSummary[]; count: number }>('/tournaments/');
  },

  detail(id: number) {
    return client.get<Tournament>(`/tournaments/${id}/`);
  },

  create(input: CreateTournamentInput) {
    return client.post<Tournament>('/tournaments/', input);
  },

  confirmDraft(id: number) {
    return client.post<Tournament>(`/tournaments/${id}/confirm-draft/`, {});
  },

  redraw(id: number) {
    return client.post<Tournament>(`/tournaments/${id}/redraw/`, {});
  },

  recordResult(id: number, matchId: string, input: MatchResultInput) {
    return client.post<Tournament>(`/tournaments/${id}/matches/${matchId}/result/`, input);
  },

  advanceGroups(id: number) {
    return client.post<Tournament>(`/tournaments/${id}/advance-groups/`, {});
  },

  updateMatchLeg(id: number, matchId: string, legs: LegRecord[], currentLeg: CurrentLeg | null) {
    return client.put(`/tournaments/${id}/match-legs/${matchId}/`, { legs, currentLeg });
  },

  destroy(id: number) {
    return client.delete(`/tournaments/${id}/`);
  },
};
