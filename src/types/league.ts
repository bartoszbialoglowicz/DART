export type LeagueFormat   = 'legs' | 'sets';
export type LeagueStatus   = 'draft' | 'active' | 'finished';
export type MemberStatus   = 'active' | 'pending';
export type MatchStatus    = 'pending' | 'finished';

export type LeagueMember = {
  id:           number;
  player_id:    number | null;
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
