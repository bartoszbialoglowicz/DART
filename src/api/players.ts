import { client } from './client';
import type { Player, PlayerPayload, PlayerStats } from '../types/player';

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

function toFormData(payload: PlayerPayload): FormData {
  const form = new FormData();
  form.append('first_name', payload.first_name);
  form.append('last_name', payload.last_name);
  if (payload.average !== undefined) form.append('average', String(payload.average));
  if (payload.cpu     !== undefined) form.append('cpu', String(payload.cpu));
  if (payload.photo      instanceof File) form.append('photo',      payload.photo);
  if (payload.winner_img instanceof File) form.append('winner_img', payload.winner_img);
  return form;
}

function hasFile(payload: PlayerPayload): boolean {
  return payload.photo instanceof File || payload.winner_img instanceof File;
}

export const playersApi = {
  list(params?: { search?: string; ordering?: string }) {
    const qs = new URLSearchParams();
    if (params?.search)   qs.set('search',   params.search);
    if (params?.ordering) qs.set('ordering', params.ordering);
    const query = qs.size ? `?${qs}` : '';
    return client.get<PaginatedResponse<Player>>(`/players/${query}`).then(r => r.results);
  },

  listPaginated(params?: { search?: string; ordering?: string; page?: number }) {
    const qs = new URLSearchParams();
    if (params?.search)   qs.set('search',   params.search);
    if (params?.ordering) qs.set('ordering', params.ordering);
    if (params?.page)     qs.set('page',     String(params.page));
    const query = qs.size ? `?${qs}` : '';
    return client.get<PaginatedResponse<Player>>(`/players/${query}`);
  },

  detail(id: number) {
    return client.get<Player>(`/players/${id}/`);
  },

  create(payload: PlayerPayload) {
    if (hasFile(payload)) return client.postForm<Player>('/players/', toFormData(payload));
    return client.post<Player>('/players/', payload);
  },

  update(id: number, payload: Partial<PlayerPayload>) {
    if (hasFile(payload as PlayerPayload)) return client.patchForm<Player>(`/players/${id}/`, toFormData(payload as PlayerPayload));
    return client.patch<Player>(`/players/${id}/`, payload);
  },

  destroy(id: number) {
    return client.delete(`/players/${id}/`);
  },

  setupProfile(payload: { first_name: string; last_name: string }) {
    return client.post<Player>('/players/setup-profile/', payload);
  },

  myStats() {
    return client.get<PlayerStats>('/players/my-stats/');
  },
};
