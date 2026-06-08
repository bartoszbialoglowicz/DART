import { client } from './client';
import type { TrainingSession, TrainingSessionPayload } from '../types/player';

export const trainingApi = {
  list() {
    return client.get<TrainingSession[]>('/training/');
  },

  create(payload: TrainingSessionPayload) {
    return client.post<TrainingSession>('/training/', payload);
  },

  update(id: number, payload: Partial<TrainingSessionPayload>) {
    return client.patch<TrainingSession>(`/training/${id}/`, payload);
  },

  destroy(id: number) {
    return client.delete(`/training/${id}/`);
  },
};
