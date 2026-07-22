import { client } from './client';
import type {
  League,
  LeagueListItem,
  LeagueMatch,
  LeagueMatchStats,
  LeagueMember,
  LeaguePayload,
  StandingsRow,
} from '../types/league';
import type { CurrentLeg, LegRecord } from '../types/bracket';

interface Paginated<T> { count: number; results: T[] }

export const leaguesApi = {
  list() {
    return client.get<Paginated<LeagueListItem>>('/leagues/').then(r => r.results);
  },

  detail(id: number) {
    return client.get<League>(`/leagues/${id}/`);
  },

  create(payload: LeaguePayload) {
    return client.post<League>('/leagues/', payload);
  },

  update(id: number, payload: Partial<LeaguePayload>) {
    return client.patch<League>(`/leagues/${id}/`, payload);
  },

  destroy(id: number) {
    return client.delete(`/leagues/${id}/`);
  },

  // Members
  addMember(id: number, data: { player_id?: number; display_name?: string }) {
    return client.post<LeagueMember>(`/leagues/${id}/members/`, data);
  },

  removeMember(id: number, memberId: number) {
    return client.delete(`/leagues/${id}/members/${memberId}/`);
  },

  linkPlayer(id: number, memberId: number, player_id: number) {
    return client.patch<LeagueMember>(`/leagues/${id}/members/${memberId}/link-player/`, { player_id });
  },

  // Schedule
  schedule(id: number) {
    return client.get<LeagueMatch[]>(`/leagues/${id}/schedule/`);
  },

  generateSchedule(id: number) {
    return client.post<LeagueMatch[]>(`/leagues/${id}/generate-schedule/`, {});
  },

  clearSchedule(id: number) {
    return client.delete(`/leagues/${id}/schedule/`);
  },

  updateMatch(id: number, matchId: number, data: Partial<LeagueMatchStats> & {
    home_score?: number; away_score?: number; scheduled_at?: string;
  }) {
    return client.patch<LeagueMatch>(`/leagues/${id}/matches/${matchId}/`, data);
  },

  approveMatch(id: number, matchId: number) {
    return client.post<LeagueMatch>(`/leagues/${id}/matches/${matchId}/approve/`, {});
  },

  updateMatchLeg(id: number, matchId: number, legs: LegRecord[], currentLeg: CurrentLeg | null) {
    return client.patch<{ match_id: number; legs: LegRecord[]; currentLeg: CurrentLeg | null }>(
      `/leagues/${id}/matches/${matchId}/leg/`, { legs, currentLeg },
    );
  },

  setMatchdayDate(id: number, matchday: number, date: string | null) {
    return client.patch<LeagueMatch[]>(`/leagues/${id}/matchday/${matchday}/`, { date });
  },

  finalize(id: number) {
    return client.post<League>(`/leagues/${id}/finalize/`, {});
  },

  // Standings
  standings(id: number) {
    return client.get<StandingsRow[]>(`/leagues/${id}/standings/`);
  },
};
