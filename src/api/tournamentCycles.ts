import { client } from './client';
import type {
  CycleEvent,
  CycleStandingsRow,
  TournamentCycle,
  TournamentCyclePayload,
} from '../types/tournamentCycle';

interface Paginated<T> { count: number; results: T[] }

export const tournamentCyclesApi = {
  list() {
    return client.get<Paginated<TournamentCycle>>('/tournament-cycles/').then(r => r.results);
  },

  detail(id: number) {
    return client.get<TournamentCycle>(`/tournament-cycles/${id}/`);
  },

  create(payload: TournamentCyclePayload) {
    return client.post<TournamentCycle>('/tournament-cycles/', payload);
  },

  update(id: number, payload: Partial<TournamentCyclePayload>) {
    return client.patch<TournamentCycle>(`/tournament-cycles/${id}/`, payload);
  },

  destroy(id: number) {
    return client.delete(`/tournament-cycles/${id}/`);
  },

  addEvent(id: number, data: { name: string; planned_date: string | null }) {
    return client.post<CycleEvent>(`/tournament-cycles/${id}/events/`, data);
  },

  updateEvent(id: number, eventId: number, data: { name?: string; planned_date?: string | null; tournament_id?: number | null }) {
    return client.patch<CycleEvent>(`/tournament-cycles/${id}/events/${eventId}/`, data);
  },

  standings(id: number) {
    return client.get<CycleStandingsRow[]>(`/tournament-cycles/${id}/standings/`);
  },
};
