import { client } from './client';
import type { Venue, VenuePayload } from '../types/venue';

export const venuesApi = {
  list() {
    return client.get<{ results: Venue[]; count: number }>('/venues/').then(r => r.results);
  },

  create(payload: VenuePayload) {
    return client.post<Venue>('/venues/', payload);
  },

  update(id: number, payload: Partial<VenuePayload>) {
    return client.patch<Venue>(`/venues/${id}/`, payload);
  },

  destroy(id: number) {
    return client.delete(`/venues/${id}/`);
  },
};
