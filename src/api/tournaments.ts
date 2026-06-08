import { client } from './client';
import type { BracketData } from '../types/bracket';

export interface Tournament {
  id: number;
  name: string;
  format: string;
  bracket: BracketData;
  is_active: boolean;
  owner_username: string | null;
  created_at: string;
  updated_at: string;
}

export const tournamentsApi = {
  list() {
    return client.get<{ results: Tournament[]; count: number }>('/tournaments/');
  },

  detail(id: number) {
    return client.get<Tournament>(`/tournaments/${id}/`);
  },

  create(bracket: BracketData) {
    return client.post<Tournament>('/tournaments/', {
      name: bracket.name,
      format: bracket.format,
      bracket,
    });
  },

  update(id: number, bracket: BracketData) {
    return client.patch<Tournament>(`/tournaments/${id}/`, { bracket });
  },

  destroy(id: number) {
    return client.delete(`/tournaments/${id}/`);
  },
};
