import type { MatchFormat } from './tournament';

export type MatchSlot = {
  playerId:   number | null;
  playerName: string | null;
  playerAvg:  number | null;
  isCpu:      boolean;
  cpuSigma?:  number;
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

export type BracketMatch = {
  id:           string;
  top:          MatchSlot;
  bottom:       MatchSlot;
  result?:      MatchResult;
  legs?:        LegRecord[];
  currentLeg?:  CurrentLeg;
};

export type BracketRound = {
  id: string;
  label: string;
  matches: BracketMatch[];
};

export type KnockoutBracketData = {
  format: 'knockout';
  name: string;
  playerCount: number;
  matchFormat: MatchFormat;
  rounds: BracketRound[];
};

export type Group = {
  id: string;
  label: string;
  slots: MatchSlot[];
  matches: BracketMatch[];
};

export type GroupsBracketData = {
  format: 'groups';
  name: string;
  playerCount: number;
  matchFormat: MatchFormat;
  groups: Group[];
  playoff?: { rounds: BracketRound[] };
};

export type BracketData = KnockoutBracketData | GroupsBracketData;
