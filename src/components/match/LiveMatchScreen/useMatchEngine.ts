import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { BracketMatch, DoubleAttempt, LegRecord, LegRound } from '../../../types/bracket';
import type { MatchFormat } from '../../../types/tournament';
import { currentLegAvg, matchAvg } from '../../../utils/statistics';
import { cpuVisitDoubleAttempt, getCheckoutHint, simulateCpuVisit } from '../../../utils/dart501';

// ── Local types ───────────────────────────────────────────────────────────────

export type Score      = { score: number; remaining: number; doubleAttempt?: DoubleAttempt };
export type Round      = { p0?: Score; p1?: Score };
export type Phase      = 'playing' | 'leg-won' | 'set-won' | 'match-won' | 'bull-shoot';
export type EditTarget = { roundIdx: number; player: 0 | 1 } | null;
export type DoubleModalPending = { score: number; remainingBefore: number; isClosing: boolean };

const START = 501;

type Props = {
  match:           BracketMatch;
  matchFormat:     MatchFormat;
  isOwner:         boolean;
  onClose:         () => void;
  onResult:        (topScore: number, bottomScore: number) => void;
  onLegComplete?:  (legs: LegRecord[], rounds: LegRound[], activePlayer: 0 | 1) => void;
  onScoreEntered?: (rounds: LegRound[], activePlayer: 0 | 1) => void;
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useMatchEngine({ match, matchFormat, isOwner, onClose, onResult, onLegComplete, onScoreEntered }: Props) {
  const { top, bottom } = match;
  const bothCpu = top.isCpu && bottom.isCpu;

  const legsToWin  = Math.ceil(matchFormat.legs / 2);
  const setsToWin  = Math.ceil(matchFormat.sets / 2);
  const isMultiSet = matchFormat.sets > 1;
  // null = unlimited; divide by 3 to get max visits per player
  const maxVisitsPerPlayer = matchFormat.max_darts_per_leg != null
    ? Math.floor(matchFormat.max_darts_per_leg / 3)
    : null;

  const savedLegs    = match.legs       ?? [];
  const savedCurrent = match.currentLeg ?? { rounds: [], activePlayer: 0 as const };

  const [rounds,             setRounds]             = useState<Round[]>(savedCurrent.rounds);
  const [activePlayer,       setActivePlayer]       = useState<0 | 1>(savedCurrent.activePlayer);
  const [legStartPlayer,     setLegStartPlayer]     = useState<0 | 1>(savedCurrent.activePlayer);
  const [input,              setInput]              = useState('');
  const [editTarget,         setEditTarget]         = useState<EditTarget>(null);
  const [legsWon,            setLegsWon]            = useState<[number, number]>([
    savedLegs.filter(l => l.winner === 'top').length,
    savedLegs.filter(l => l.winner === 'bottom').length,
  ]);
  const [setsWon,            setSetsWon]            = useState<[number, number]>([0, 0]);
  const [phase,              setPhase]              = useState<Phase>('playing');
  const [legWinner,          setLegWinner]          = useState<0 | 1>(0);
  const [completedLegs,      setCompletedLegs]      = useState<LegRecord[]>(savedLegs);
  const [doubleModalPending, setDoubleModalPending] = useState<DoubleModalPending | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Derived state ─────────────────────────────────────────────────────────

  const p0Remaining = START - rounds.reduce((s, r) => s + (r.p0?.score ?? 0), 0);
  const p1Remaining = START - rounds.reduce((s, r) => s + (r.p1?.score ?? 0), 0);
  const currentRemaining = activePlayer === 0 ? p0Remaining : p1Remaining;

  const inputNum = input === '' ? 0 : Number(input);

  const editMaxScore = editTarget !== null
    ? START - rounds.slice(0, editTarget.roundIdx).reduce(
        (s, r) => s + (editTarget.player === 0 ? (r.p0?.score ?? 0) : (r.p1?.score ?? 0)), 0
      )
    : 0;
  const editHasSubsequent = editTarget !== null && rounds.slice(editTarget.roundIdx + 1).some(
    r => editTarget.player === 0 ? !!r.p0 : !!r.p1
  );
  const effectiveMax      = Math.min(editTarget !== null ? editMaxScore : currentRemaining, 180);
  const isOverMax         = input !== '' && inputNum > effectiveMax;
  const editWouldCheckout = editTarget !== null && input !== '' && inputNum === editMaxScore && editHasSubsequent;
  const canConfirm        = input !== '' && !isOverMax && !editWouldCheckout;

  const activeSlot = activePlayer === 0 ? top : bottom;
  const isCpuTurn  = phase === 'playing' && activeSlot.isCpu;

  const canToggleStart = isOwner && phase === 'playing' && completedLegs.length === 0 && rounds.length === 0 && input === '' && editTarget === null;

  const lastRound = rounds[rounds.length - 1];
  const p0Pending = editTarget === null && activePlayer === 0 && input !== '';
  const p1Pending = editTarget === null && activePlayer === 1 && input !== '' && !!lastRound?.p0 && !lastRound?.p1;

  const overlayScore = isMultiSet
    ? `${setsWon[0]} – ${setsWon[1]}`
    : `${legsWon[0]} – ${legsWon[1]}`;

  // ── Callbacks ─────────────────────────────────────────────────────────────

  const pressDigit = useCallback((d: string) => {
    setInput(prev => {
      const next = prev + d;
      return next.length > 3 ? prev : next;
    });
  }, []);

  const pressClear = useCallback(() => {
    if (editTarget !== null && input === '') { setEditTarget(null); return; }
    setInput('');
  }, [editTarget, input]);

  const applyScore = useCallback((score: number, doubleAttempt?: DoubleAttempt) => {
    // Read from refs to guarantee fresh state even when called from a stale closure
    // (e.g. the CPU timer fires 900 ms after the last render).
    const curRounds       = roundsRef.current;
    const curActivePlayer = activePlayerRef.current;

    const p0Rem     = START - curRounds.reduce((s, r) => s + (r.p0?.score ?? 0), 0);
    const p1Rem     = START - curRounds.reduce((s, r) => s + (r.p1?.score ?? 0), 0);
    const remaining = (curActivePlayer === 0 ? p0Rem : p1Rem) - score;
    const newScore: Score = { score, remaining, ...(doubleAttempt ? { doubleAttempt } : {}) };

    let newRounds: Round[];
    if (curActivePlayer === 0) {
      const last = curRounds[curRounds.length - 1];
      // p1 started this leg and already has a score in the last row — fill p0 into it.
      if (last && last.p1 !== undefined && last.p0 === undefined) {
        newRounds = [...curRounds.slice(0, -1), { ...last, p0: newScore }];
      } else {
        newRounds = [...curRounds, { p0: newScore }];
      }
    } else {
      const last = curRounds[curRounds.length - 1];
      // p0 started this leg and already has a score in the last row — fill p1 into it.
      if (last && last.p0 !== undefined && last.p1 === undefined) {
        newRounds = [...curRounds.slice(0, -1), { ...last, p1: newScore }];
      } else {
        newRounds = [...curRounds, { p1: newScore }];
      }
    }

    setRounds(newRounds);
    roundsRef.current = newRounds; // keep ref in sync immediately (before next render)

    if (remaining === 0) {
      const legRecord: LegRecord = {
        rounds: newRounds,
        winner: curActivePlayer === 0 ? 'top' : 'bottom',
      };
      const newCompletedLegs = [...completedLegs, legRecord];
      setCompletedLegs(newCompletedLegs);
      onLegComplete?.(newCompletedLegs, newRounds, curActivePlayer);

      const newLegsWon: [number, number] = [legsWon[0], legsWon[1]];
      newLegsWon[curActivePlayer]++;
      setLegWinner(curActivePlayer);

      if (newLegsWon[curActivePlayer] >= legsToWin) {
        const newSetsWon: [number, number] = [setsWon[0], setsWon[1]];
        newSetsWon[curActivePlayer]++;
        setSetsWon(newSetsWon);
        setLegsWon(newLegsWon);
        setPhase(newSetsWon[curActivePlayer] >= setsToWin ? 'match-won' : 'set-won');
      } else {
        setLegsWon(newLegsWon);
        setPhase('leg-won');
      }
    } else {
      // Check if both players have exhausted their max darts for this leg
      if (maxVisitsPerPlayer !== null) {
        const p0Visits = newRounds.filter(r => r.p0 !== undefined).length;
        const p1Visits = newRounds.filter(r => r.p1 !== undefined).length;
        if (p0Visits >= maxVisitsPerPlayer && p1Visits >= maxVisitsPerPlayer) {
          setPhase('bull-shoot');
          onScoreEntered?.(newRounds, curActivePlayer === 0 ? 1 : 0);
          return;
        }
      }
      const nextPlayer: 0 | 1 = curActivePlayer === 0 ? 1 : 0;
      setActivePlayer(nextPlayer);
      activePlayerRef.current = nextPlayer; // keep ref in sync immediately
      onScoreEntered?.(newRounds, nextPlayer);
    }
  }, [completedLegs, legsWon, setsWon, legsToWin, setsToWin, maxVisitsPerPlayer, onLegComplete, onScoreEntered]);

  const applyScoreEdit = useCallback((roundIdx: number, player: 0 | 1, newScore: number) => {
    const newRounds: Round[] = rounds.map((r, i) => {
      if (i < roundIdx) return r;
      let cum = 0;
      for (let j = 0; j < i; j++) {
        cum += j === roundIdx
          ? newScore
          : (player === 0 ? (rounds[j].p0?.score ?? 0) : (rounds[j].p1?.score ?? 0));
      }
      const scoreHere = i === roundIdx
        ? newScore
        : (player === 0 ? (r.p0?.score ?? 0) : (r.p1?.score ?? 0));
      const newRem = START - cum - scoreHere;
      if (player === 0) return r.p0 !== undefined ? { ...r, p0: { ...r.p0, score: scoreHere, remaining: newRem } } : r;
      return r.p1 !== undefined ? { ...r, p1: { ...r.p1, score: scoreHere, remaining: newRem } } : r;
    });
    setRounds(newRounds);
    onScoreEntered?.(newRounds, activePlayer);
  }, [rounds, activePlayer, onScoreEntered]);

  const openEdit = useCallback((roundIdx: number, player: 0 | 1) => {
    if (!isOwner || phase !== 'playing' || isCpuTurn) return;
    setEditTarget({ roundIdx, player });
    setInput('');
  }, [isOwner, phase, isCpuTurn]);

  const confirmScore = useCallback(() => {
    if (!canConfirm || isCpuTurn) return;
    if (editTarget !== null) {
      applyScoreEdit(editTarget.roundIdx, editTarget.player, Number(input));
      setEditTarget(null);
      setInput('');
      return;
    }
    const score = Number(input);
    setInput('');
    const isClosing = score === currentRemaining;
    // Show double-attempt modal when:
    // • the leg is closed (always — any closing throw must end on a double), OR
    // • remaining ≤ 50 AND (a checkout route exists OR remaining ≤ 40, i.e. D1-D20 zone)
    const inDoubleZone =
      isClosing ||
      (currentRemaining <= 50 && (getCheckoutHint(currentRemaining) !== null || currentRemaining <= 40));
    if (inDoubleZone) {
      setDoubleModalPending({ score, remainingBefore: currentRemaining, isClosing });
    } else {
      applyScore(score);
    }
  }, [canConfirm, isCpuTurn, input, currentRemaining, applyScore, editTarget, applyScoreEdit]);

  function resolveBullShoot(winner: 0 | 1) {
    const curRounds = roundsRef.current;
    const legRecord: LegRecord = { rounds: curRounds, winner: winner === 0 ? 'top' : 'bottom' };
    const newCompletedLegs = [...completedLegs, legRecord];
    setCompletedLegs(newCompletedLegs);
    onLegComplete?.(newCompletedLegs, curRounds, winner);

    const newLegsWon: [number, number] = [legsWon[0], legsWon[1]];
    newLegsWon[winner]++;
    setLegWinner(winner);

    if (newLegsWon[winner] >= legsToWin) {
      const newSetsWon: [number, number] = [setsWon[0], setsWon[1]];
      newSetsWon[winner]++;
      setSetsWon(newSetsWon);
      setLegsWon(newLegsWon);
      setPhase(newSetsWon[winner] >= setsToWin ? 'match-won' : 'set-won');
    } else {
      setLegsWon(newLegsWon);
      setPhase('leg-won');
    }
  }

  function setStartPlayer(player: 0 | 1) {
    setActivePlayer(player);
    setLegStartPlayer(player);
  }

  function startNext() {
    const nextStart: 0 | 1 = legStartPlayer === 0 ? 1 : 0;
    setLegStartPlayer(nextStart);
    setRounds([]);
    setInput('');
    setActivePlayer(nextStart);
    if (phase === 'set-won') setLegsWon([0, 0]);
    setPhase('playing');
    onScoreEntered?.([], nextStart);
  }

  // ── Effects ───────────────────────────────────────────────────────────────

  // Auto-save exactly once when the match is won — the result must persist the
  // instant the last leg finishes, not only if/when the user clicks a button.
  const resultSavedRef = useRef(false);
  useEffect(() => {
    if (phase !== 'match-won' || !isOwner || resultSavedRef.current) return;
    resultSavedRef.current = true;
    const topScore    = isMultiSet ? setsWon[0] : legsWon[0];
    const bottomScore = isMultiSet ? setsWon[1] : legsWon[1];
    onResult(topScore, bottomScore);
  }, [phase, isOwner, isMultiSet, setsWon, legsWon, onResult]);

  // Always-fresh refs — guarantee CPU timer sees the latest state regardless of render timing
  const applyScoreRef    = useRef(applyScore);
  const roundsRef        = useRef(rounds);
  const activePlayerRef  = useRef(activePlayer);
  useLayoutEffect(() => {
    applyScoreRef.current   = applyScore;
    roundsRef.current       = rounds;
    activePlayerRef.current = activePlayer;
  });

  // CPU auto-play: fires whenever it becomes the CPU's turn.
  // Deps include activePlayer/rounds.length, not just currentRemaining — in a
  // bot-vs-bot match isCpuTurn is always true, and every leg starts with both
  // players at the same remaining score, so currentRemaining alone can repeat
  // across the turn flip and React would skip re-running the effect.
  useEffect(() => {
    if (!isCpuTurn) return;
    const sigma = activeSlot.cpuSigma ?? 55;
    const rem   = currentRemaining;
    const t = setTimeout(() => {
      const visit = simulateCpuVisit(rem, sigma);
      const doubleAttempt = rem <= 170 ? cpuVisitDoubleAttempt(visit, rem) : undefined;
      applyScoreRef.current(visit.totalScored, doubleAttempt);
    }, 900);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCpuTurn, activePlayer, rounds.length, currentRemaining]);

  // Bot-vs-bot matches have no human to click "Następny leg/set" — advance on
  // their behalf so "Symuluj na żywo" plays out unattended end to end.
  useEffect(() => {
    if (!bothCpu || (phase !== 'leg-won' && phase !== 'set-won')) return;
    const t = setTimeout(() => startNext(), 1200);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bothCpu, phase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [rounds.length, activePlayer]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (editTarget !== null) { setEditTarget(null); setInput(''); return; }
        onClose();
        return;
      }
      if (phase !== 'playing' || isCpuTurn) return;
      if (e.key === 'Backspace') { pressClear();   return; }
      if (e.key === 'Enter')     { confirmScore(); return; }
      if (/^[0-9]$/.test(e.key)) pressDigit(e.key);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, pressDigit, pressClear, confirmScore, phase, isCpuTurn, editTarget]);

  // ── Averages (passed to PlayerHeader) ────────────────────────────────────

  const p0LegAvg   = currentLegAvg(rounds, 0);
  const p1LegAvg   = currentLegAvg(rounds, 1);
  const p0MatchAvg = matchAvg(completedLegs, rounds, 0);
  const p1MatchAvg = matchAvg(completedLegs, rounds, 1);

  return {
    // state
    rounds, activePlayer, input, editTarget, legsWon, setsWon,
    phase, legWinner, completedLegs, doubleModalPending,
    // derived
    p0Remaining, p1Remaining, inputNum, effectiveMax,
    isOverMax, editWouldCheckout, canConfirm,
    isCpuTurn, isMultiSet, canToggleStart,
    p0Pending, p1Pending, overlayScore,
    activeSlot,
    // averages
    p0LegAvg, p1LegAvg, p0MatchAvg, p1MatchAvg,
    // refs
    bottomRef,
    // actions
    pressDigit, pressClear, confirmScore, applyScore,
    setStartPlayer, startNext, resolveBullShoot,
    setEditTarget, setInput, setDoubleModalPending,
    openEdit,
  };
}
