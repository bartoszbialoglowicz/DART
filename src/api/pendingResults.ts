import { client } from './client';
import type { PendingMatchResult, PendingMatchResultPayload } from '../types/player';

type Paginated<T> = { count: number; results: T[] };

export const pendingResultsApi = {
  async list(): Promise<PendingMatchResult[]> {
    const res = await client.get<Paginated<PendingMatchResult>>('/pending-results/');
    return res.results;
  },

  create(payload: PendingMatchResultPayload) {
    return client.post<PendingMatchResult>('/pending-results/', payload);
  },

  approve(id: number) {
    return client.post(`/pending-results/${id}/approve/`, {});
  },

  dismiss(id: number) {
    return client.delete(`/pending-results/${id}/`);
  },
};
