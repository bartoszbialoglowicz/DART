import { client } from './client';
import type { HighscoreSession, HighscoreSessionPayload } from '../types/player';

type Paginated<T> = { count: number; results: T[] };

export const highscoreApi = {
  async list(): Promise<HighscoreSession[]> {
    const res = await client.get<Paginated<HighscoreSession>>('/highscores/');
    return res.results;
  },

  create(payload: HighscoreSessionPayload) {
    return client.post<HighscoreSession>('/highscores/', payload);
  },
};
