import type { CurrentLeg, LegRecord } from './bracket';

export type LeagueFormat   = 'legs' | 'sets';
export type LeagueStatus   = 'draft' | 'active' | 'finished';
export type MemberStatus   = 'active' | 'pending';
export type MatchStatus    = 'pending' | 'awaiting_approval' | 'finished';

export type LeagueMember = {
  id:           number;
  player_id:    number | null;
  is_cpu:       boolean;
  display_name: string;
  status:       MemberStatus;
  joined_at:    string;
};

export type LeagueMatch = {
  id:           number;
  matchday:     number;
  home:         number;
  away:         number;
  home_name:    string;
  away_name:    string;
  scheduled_at: string | null;
  status:       MatchStatus;
  home_score:   number | null;
  away_score:   number | null;
  played_at:    string | null;
  submitted_by_username: string | null;
  home_count_180:        number;
  away_count_180:        number;
  home_high_checkouts:   number;
  away_high_checkouts:   number;
  home_short_legs:       number;
  away_short_legs:       number;
  legs:         LegRecord[];
  current_leg:  CurrentLeg | null;
};

export type LeagueMatchStats = {
  home_count_180:      number;
  away_count_180:      number;
  home_high_checkouts: number;
  away_high_checkouts: number;
  home_short_legs:     number;
  away_short_legs:     number;
};

export type StandingsRow = {
  position:      number;
  member_id:     number;
  display_name:  string;
  player_id:     number | null;
  status:        MemberStatus;
  played:        number;
  won:           number;
  drawn:         number;
  lost:          number;
  score_for:     number;
  score_against: number;
  points:        number;
};

export type League = {
  id:              number;
  name:            string;
  owner_username:  string | null;
  is_private:      boolean;
  matches_per_pair: number;
  points_win:      number;
  points_draw:     number;
  match_format:    LeagueFormat;
  sets:            number;
  legs:            number;
  status:          LeagueStatus;
  created_at:      string;
  updated_at:      string;
  members:         LeagueMember[];
  member_count:    number;
  match_count:     number;
};

export type LeagueListItem = Omit<League, 'members' | 'match_count' | 'updated_at'>;

export type LeaguePayload = {
  name:             string;
  is_private:       boolean;
  matches_per_pair: number;
  points_win:       number;
  points_draw:      number;
  match_format:     LeagueFormat;
  sets:             number;
  legs:             number;
};
