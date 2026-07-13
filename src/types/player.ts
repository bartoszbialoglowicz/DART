export type Player = {
  id: number;
  user_id:    number | null;
  first_name: string;
  last_name:  string;
  average:    string;
  photo:      string | null;
  winner_img: string | null;
  cpu:        boolean;
  created_at: string;
};

export type TrainingSession = {
  id:              number;
  played_at:       string;
  average:         number;
  legs:            number;
  double_attempts: number;
  double_hits:     number;
  notes:           string;
  created_at:      string;
};

export type TrainingSessionPayload = {
  played_at:        string;
  average:          number;
  legs:             number;
  double_attempts?: number;
  double_hits?:     number;
  notes?:           string;
};

export type HighscoreSession = {
  id:         number;
  played_at:  string;
  darts:      number;
  score:      number;
  created_at: string;
};

export type HighscoreSessionPayload = {
  played_at: string;
  darts:     number;
  score:     number;
};

export type SectorPracticeSession = {
  id:         number;
  played_at:  string;
  sector:     string;
  hit_rate:   number;
  score:      number;
  created_at: string;
};

export type SectorPracticeSessionPayload = {
  played_at: string;
  sector:    string;
  hit_rate:  number;
  score:     number;
};

export type PlayerStats = {
  player: Player;
  stats: {
    matches_played:  number;
    match_average:   number;
    double_accuracy: number | null;
    darts_per_leg:   number;
    count_180:       number;
    high_checkouts:  number;
    short_legs:      number;
  };
};

export type PendingMatchResult = {
  id:              number;
  opponent_name:   string;
  played_at:       string;
  average:         number;
  legs_won:        number;
  legs_lost:       number;
  double_attempts: number;
  double_hits:     number;
  created_at:      string;
};

export type PendingMatchResultPayload = {
  for_player_id:   number;
  opponent_name:   string;
  played_at:       string;
  average:         number;
  legs_won:        number;
  legs_lost:       number;
  double_attempts: number;
  double_hits:     number;
};

export type PlayerEventType = 'league_match' | 'tournament';

export type PlayerEvent = {
  type:           PlayerEventType;
  date:           string;
  title:          string;
  subtitle:       string;
  league_id?:     number;
  tournament_id?: number;
  matchday?:      number;
};

export type PlayerPayload = {
  first_name: string;
  last_name: string;
  average?: number;
  photo?:      File | null;
  winner_img?: File | null;
  cpu?:        boolean;
};
