import { client } from './client';
import type { TrainingSession, TrainingSessionPayload } from '../types/player';

type Paginated<T> = { count: number; results: T[] };

export const trainingApi = {
  async list(): Promise<TrainingSession[]> {
    const res = await client.get<Paginated<TrainingSession>>('/training/');
    return res.results;
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
