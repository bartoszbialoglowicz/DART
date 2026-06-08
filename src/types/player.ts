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

export type PlayerPayload = {
  first_name: string;
  last_name: string;
  average?: number;
  photo?:      File | null;
  winner_img?: File | null;
  cpu?:        boolean;
};
