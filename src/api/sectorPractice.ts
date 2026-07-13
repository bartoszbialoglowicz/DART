import { client } from './client';
import type { SectorPracticeSession, SectorPracticeSessionPayload } from '../types/player';

type Paginated<T> = { count: number; results: T[] };

export const sectorPracticeApi = {
  async list(): Promise<SectorPracticeSession[]> {
    const res = await client.get<Paginated<SectorPracticeSession>>('/sector-practice/');
    return res.results;
  },

  create(payload: SectorPracticeSessionPayload) {
    return client.post<SectorPracticeSession>('/sector-practice/', payload);
  },
};
