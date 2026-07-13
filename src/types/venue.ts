export type Venue = {
  id:                number;
  name:              string;
  address:           string;
  board_count:       number;
  default_sets:      number;
  default_legs:      number;
  max_darts_per_leg: number | null;
  created_at:        string;
  updated_at:        string;
};

export type VenuePayload = Omit<Venue, 'id' | 'created_at' | 'updated_at'>;
