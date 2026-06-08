import { client } from './client';
import type { PlayerMatchStats } from '../utils/statistics';

export type StatisticRecord = {
  id:             number;
  match_id:       string;
  player_name:    string;
  match_average:  number;
  count_180:      number;
  high_checkouts: number;
  short_legs:     number;
};

export const statisticsApi = {
  list(tournamentId: number) {
    return client.get<StatisticRecord[]>(`/tournaments/${tournamentId}/statistics/`);
  },

  save(tournamentId: number, stats: PlayerMatchStats[]) {
    return client.put<StatisticRecord[]>(`/tournaments/${tournamentId}/statistics/`, stats);
  },
};
