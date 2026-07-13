export type CycleScoringMode = 'placement' | 'match_wins';
export type CycleStatus      = 'draft' | 'active' | 'finished';

export type PlacementPoints = {
  winner:       number;
  final:        number;
  semifinal:    number;
  quarterfinal: number;
  other:        number;
};

export type CycleEvent = {
  id:                number;
  name:              string;
  planned_date:      string | null;
  order:             number;
  tournament_id:     number | null;
  tournament_name:   string | null;
  tournament_active: boolean | null;
};

export type TournamentCycle = {
  id:                         number;
  name:                       string;
  is_private:                 boolean;
  status:                     CycleStatus;
  scoring_mode:               CycleScoringMode;
  placement_points:           PlacementPoints;
  bonus_180_points:           number | null;
  bonus_high_checkout_points: number | null;
  owner_username:             string | null;
  events:                     CycleEvent[];
  created_at:                 string;
  updated_at:                 string;
};

export type CycleEventInput = {
  name:         string;
  planned_date: string | null;
};

export type TournamentCyclePayload = {
  name:                       string;
  is_private:                 boolean;
  scoring_mode:               CycleScoringMode;
  placement_points:           PlacementPoints;
  bonus_180_points:           number | null;
  bonus_high_checkout_points: number | null;
  events:                     CycleEventInput[];
};

export type CycleStandingsRow = {
  player_id:       number | null;
  player_name:     string;
  total_points:    number;
  points_by_event: Record<number, number>;
};

export const DEFAULT_PLACEMENT_POINTS: PlacementPoints = {
  winner:       10,
  final:        7,
  semifinal:    5,
  quarterfinal: 3,
  other:        1,
};
