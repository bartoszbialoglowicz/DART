/** A tournament or league an account-less player took part in. */
export type GuestTournament = {
  kind:         'tournament' | 'league';
  id:           number;
  name:         string;
  display_name: string;  // the name the player had in that tournament
  date:         string;  // YYYY-MM-DD
};

/** The signed-in player's code for organizers, or nulls when none is active. */
export type LinkCode = {
  code:       string | null;  // 'K7QM-3XPA'
  expires_at: string | null;
};

/** An organizer's own account-less player ("gracz bez konta"). */
export type GuestPlayer = {
  id:          number;
  name:        string;
  linked_to:   string | null;  // profile name once linked to an account
  tournaments: GuestTournament[];
};

/** An account-less player an organizer has linked to my profile. */
export type LinkedGuest = {
  id:             number;
  name:           string;
  owner_username: string | null;
  tournaments:    GuestTournament[];
};

/** A registered player who gave me their code — I can add them to my events. */
export type Contact = {
  id:   number;  // their Player (profile) id
  name: string;
};

/** An organizer who may add me to their tournaments and leagues. */
export type Organizer = {
  id:       number;  // user id
  username: string;
};
