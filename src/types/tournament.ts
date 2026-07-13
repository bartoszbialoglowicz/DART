import type { Player } from './player';
import type { PhaseConfig } from './bracket';

export type TournamentFormat = 'knockout' | 'groups';

export type MatchFormat = {
  sets:              number;
  legs:              number;
  max_darts_per_leg?: number | null;
};

export type { PhaseConfig };

/** Minimal player shape needed for bracket generation. Negative id = placeholder. */
export type TournamentPlayer = Pick<Player, 'id' | 'first_name' | 'last_name' | 'average' | 'cpu'>;

export type TournamentConfig = {
  name:              string;
  format:            TournamentFormat;
  matchFormat:       MatchFormat;
  groupSize:         number;
  phaseConfigs:      Record<string, PhaseConfig>;
  players:           TournamentPlayer[];
  is_private:        boolean;
  start_date:        string | null;
  venue_id?:         number | null;
  venue_board_count?: number | null;
};

export const GROUP_SIZE_OPTIONS  = [3, 4, 5] as const;

export const SET_MIN = 1, SET_MAX = 15;
export const LEG_MIN = 1, LEG_MAX = 21;

/**
 * A leg is played in turns of 3 darts, so any darts-per-leg limit must be a
 * multiple of 3 — invalid input rounds to the nearest one instead of being
 * rejected, so the field never has to explain the rule to the user.
 */
export function roundToNearestMultipleOf3(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 3;
  return Math.max(3, Math.round(value / 3) * 3);
}

/** A "best of N" match needs an odd N so it always has a decisive winner. */
export function roundToNearestOdd(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  const clamped = Math.min(max, Math.max(min, Math.round(value)));
  return clamped % 2 === 0 ? clamped + (clamped < max ? 1 : -1) : clamped;
}
