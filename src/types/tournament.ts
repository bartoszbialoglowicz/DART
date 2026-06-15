import type { Player } from './player';

export type TournamentFormat = 'knockout' | 'groups';

export type MatchFormat = {
  sets: number;
  legs: number;
};

export type TournamentConfig = {
  name: string;
  playerCount: number;
  format: TournamentFormat;
  matchFormat: MatchFormat;
  players: Player[];
  is_private: boolean;
  start_date: string | null;
};

export const SET_OPTIONS  = [1, 3, 5, 7] as const;
export const LEG_OPTIONS  = [3, 5, 7, 9] as const;

export const KNOCKOUT_PLAYER_COUNTS = [4, 8, 16, 32] as const;
export const GROUP_PLAYER_COUNTS    = [6, 8, 10, 12, 16, 20, 24, 28, 32] as const;
