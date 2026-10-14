import type { MatchFormat } from './tournament';

export type PhaseConfig = {
  date?: string;
  matchFormat?: MatchFormat;
};

export type MatchSlot = {
  playerId:   number | null;
  playerName: string | null;
  playerAvg:  number | null;
  isCpu:      boolean;
  cpuSigma?:  number;
  entryId?:   number;  // TournamentEntry id — set by the server for occupied slots
};

export type MatchResult = {
  topSetsWon:    number;
  bottomSetsWon: number;
  displayScore:  string;
  winner:        'top' | 'bottom';
};

export type DoubleAttempt = {
  dartsAtDouble: number;   // darts aimed at a double in this visit (0–3)
  dartsToClose?: number;   // darts used to close the leg (1–3), only on winning visit
};

export type LegRound = {
  p0?: { score: number; remaining: number; doubleAttempt?: DoubleAttempt };
  p1?: { score: number; remaining: number; doubleAttempt?: DoubleAttempt };
};

export type LegRecord = {
  rounds: LegRound[];
  winner: 'top' | 'bottom';
};

export type CurrentLeg = {
  rounds:       LegRound[];
  activePlayer: 0 | 1;
};

export type MatchStatus = 'pending' | 'live' | 'finished' | 'bye';

export type BracketMatch = {
  id:           string;
  top:          MatchSlot;
  bottom:       MatchSlot;
  result?:      MatchResult;
  legs?:        LegRecord[];
  currentLeg?:  CurrentLeg;
  status?:      MatchStatus;
  matchFormat?: MatchFormat;  // resolved format (round → phase → tournament default)
};

export type BracketRound = {
  id:           string;
  label:        string;
  date?:        string;
  matchFormat?: MatchFormat;
  matches:      BracketMatch[];
};

export type KnockoutBracketData = {
  format:        'knockout';
  name:          string;
  playerCount:   number;
  matchFormat:   MatchFormat;
  phaseConfigs?: Record<string, PhaseConfig>;
  rounds:        BracketRound[];
};

/** Server-computed group table row (headline score = legs in a single-set format). */
export type GroupStandingRow = {
  entryId:     number;
  played:      number;
  wins:        number;
  losses:      number;
  legsFor:     number;
  legsAgainst: number;
  points:      number;
};

export type Group = {
  id:     string;
  label:  string;
  slots:  MatchSlot[];
  matches: BracketMatch[];
  board?: number;  // 1-based board number, present only when tournament has a venue
  standings?: GroupStandingRow[];
};

export type GroupsBracketData = {
  format:        'groups';
  name:          string;
  playerCount:   number;
  matchFormat:   MatchFormat;
  phaseConfigs?: Record<string, PhaseConfig>;
  groups:        Group[];
  playoff?:      { rounds: BracketRound[] };
  board_count?:  number;  // venue board count stored for reference
};

export type BracketData = KnockoutBracketData | GroupsBracketData;
