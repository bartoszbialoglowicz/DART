import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { BracketMatch, LegRecord, LegRound } from '../../types/bracket';
import type { MatchFormat } from '../../types/tournament';
import { currentLegAvg, matchAvg } from '../../utils/statistics';
import { simulateCpuVisit } from '../../utils/dart501';
import { MatchSummaryScreen } from '../match/MatchSummaryScreen';

type Props = {
  match:            BracketMatch;
  matchFormat:      MatchFormat;
  isOwner:          boolean;
  onClose:          () => void;
  onResult:         (topScore: number, bottomScore: number) => void;
  onLegComplete?:   (legs: LegRecord[], rounds: LegRound[], activePlayer: 0 | 1) => void;
  onScoreEntered?:  (rounds: LegRound[], activePlayer: 0 | 1) => void;
};

const START = 501;

type Score      = { score: number; remaining: number };
type Round      = { p0?: Score; p1?: Score };
type KeyVar     = 'digit' | 'clear' | 'ok';
type Key        = { label: string; onPress: () => void; variant: KeyVar };
type Phase      = 'playing' | 'leg-won' | 'set-won' | 'match-won';
type EditTarget = { roundIdx: number; player: 0 | 1 } | null;

export function LiveMatchScreen({ match, matchFormat, isOwner, onClose, onResult, onLegComplete, onScoreEntered }: Props) {
  const { top, bottom } = match;

  const legsToWin  = Math.ceil(matchFormat.legs / 2);
  const setsToWin  = Math.ceil(matchFormat.sets / 2);
  const isMultiSet = matchFormat.sets > 1;

  const savedLegs    = match.legs       ?? [];
  const savedCurrent = match.currentLeg ?? { rounds: [], activePlayer: 0 as const };

  const [rounds,          setRounds]          = useState<Round[]>(savedCurrent.rounds);
  const [activePlayer,    setActivePlayer]    = useState<0 | 1>(savedCurrent.activePlayer);
  const [legStartPlayer,  setLegStartPlayer]  = useState<0 | 1>(savedCurrent.activePlayer);
  const [input,           setInput]           = useState('');
  const [editTarget,      setEditTarget]      = useState<EditTarget>(null);
  const [legsWon,       setLegsWon]       = useState<[number, number]>([
    savedLegs.filter(l => l.winner === 'top').length,
    savedLegs.filter(l => l.winner === 'bottom').length,
  ]);
  const [setsWon,       setSetsWon]       = useState<[number, number]>([0, 0]);
  const [phase,         setPhase]         = useState<Phase>('playing');
  const [legWinner,     setLegWinner]     = useState<0 | 1>(0);
  const [completedLegs, setCompletedLegs] = useState<LegRecord[]>(savedLegs);
  const bottomRef = useRef<HTMLDivElement>(null);

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
  const effectiveMax      = editTarget !== null ? editMaxScore : currentRemaining;
  const isOverMax         = input !== '' && inputNum > effectiveMax;
  const editWouldCheckout = editTarget !== null && input !== '' && inputNum === editMaxScore && editHasSubsequent;
  const canConfirm        = input !== '' && !isOverMax && !editWouldCheckout;

  // CPU detection
  const activeSlot = activePlayer === 0 ? top : bottom;
  const isCpuTurn  = phase === 'playing' && activeSlot.isCpu;

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

  // Core scoring logic — called by both human (confirmScore) and CPU auto-play
  const applyScore = useCallback((score: number) => {
    const remaining = currentRemaining - score;
    const newScore: Score = { score, remaining };

    const newRounds: Round[] = activePlayer === 0
      ? [...rounds, { p0: newScore }]
      : [...rounds.slice(0, -1), { ...rounds[rounds.length - 1], p1: newScore }];

    setRounds(newRounds);

    if (remaining === 0) {
      const legRecord: LegRecord = {
        rounds: newRounds,
        winner: activePlayer === 0 ? 'top' : 'bottom',
      };
      const newCompletedLegs = [...completedLegs, legRecord];
      setCompletedLegs(newCompletedLegs);
      onLegComplete?.(newCompletedLegs, newRounds, activePlayer);

      const newLegsWon: [number, number] = [legsWon[0], legsWon[1]];
      newLegsWon[activePlayer]++;
      setLegWinner(activePlayer);

      if (newLegsWon[activePlayer] >= legsToWin) {
        const newSetsWon: [number, number] = [setsWon[0], setsWon[1]];
        newSetsWon[activePlayer]++;
        setSetsWon(newSetsWon);
        setLegsWon(newLegsWon);
        setPhase(newSetsWon[activePlayer] >= setsToWin ? 'match-won' : 'set-won');
      } else {
        setLegsWon(newLegsWon);
        setPhase('leg-won');
      }
    } else {
      const nextPlayer: 0 | 1 = activePlayer === 0 ? 1 : 0;
      setActivePlayer(nextPlayer);
      onScoreEntered?.(newRounds, nextPlayer);
    }
  }, [currentRemaining, activePlayer, rounds, completedLegs, legsWon, setsWon, legsToWin, setsToWin, onLegComplete, onScoreEntered]);

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
      if (player === 0) return r.p0 !== undefined ? { ...r, p0: { score: scoreHere, remaining: newRem } } : r;
      return r.p1 !== undefined ? { ...r, p1: { score: scoreHere, remaining: newRem } } : r;
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
    } else {
      applyScore(Number(input));
    }
    setInput('');
  }, [canConfirm, isCpuTurn, input, applyScore, editTarget, applyScoreEdit]);

  // Always-fresh ref — avoids stale closure in CPU timer without re-triggering the effect
  const applyScoreRef = useRef(applyScore);
  useLayoutEffect(() => { applyScoreRef.current = applyScore; });

  // CPU auto-play: fires whenever it becomes the CPU's turn
  useEffect(() => {
    if (!isCpuTurn) return;
    const sigma = activeSlot.cpuSigma ?? 55;
    const rem   = currentRemaining;
    const t = setTimeout(() => {
      const visit = simulateCpuVisit(rem, sigma);
      applyScoreRef.current(visit.totalScored);
    }, 900);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCpuTurn, currentRemaining]);

  const canToggleStart = isOwner && phase === 'playing' && rounds.length === 0 && input === '' && editTarget === null;

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

  function finishMatch() {
    const topScore    = isMultiSet ? setsWon[0]  : legsWon[0];
    const bottomScore = isMultiSet ? setsWon[1] : legsWon[1];
    onResult(topScore, bottomScore);
  }

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

  const lastRound   = rounds[rounds.length - 1];
  const p0Pending   = editTarget === null && activePlayer === 0 && input !== '';
  const p1Pending   = editTarget === null && activePlayer === 1 && input !== '' && lastRound?.p0 && !lastRound?.p1;

  const playerName = (idx: 0 | 1) =>
    idx === 0 ? (top.playerName ?? 'Gracz 1') : (bottom.playerName ?? 'Gracz 2');

  const rows: Key[][] = [
    [
      { label: '1', onPress: () => pressDigit('1'), variant: 'digit' },
      { label: '2', onPress: () => pressDigit('2'), variant: 'digit' },
      { label: '3', onPress: () => pressDigit('3'), variant: 'digit' },
    ],
    [
      { label: '4', onPress: () => pressDigit('4'), variant: 'digit' },
      { label: '5', onPress: () => pressDigit('5'), variant: 'digit' },
      { label: '6', onPress: () => pressDigit('6'), variant: 'digit' },
    ],
    [
      { label: '7', onPress: () => pressDigit('7'), variant: 'digit' },
      { label: '8', onPress: () => pressDigit('8'), variant: 'digit' },
      { label: '9', onPress: () => pressDigit('9'), variant: 'digit' },
    ],
    [
      { label: 'C',  onPress: pressClear,            variant: 'clear' },
      { label: '0',  onPress: () => pressDigit('0'), variant: 'digit' },
      { label: 'OK', onPress: confirmScore,          variant: 'ok'    },
    ],
  ];

  const overlayScore = isMultiSet
    ? `${setsWon[0]} – ${setsWon[1]}`
    : `${legsWon[0]} – ${legsWon[1]}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-brand-black select-none">

      {/* ── Top section ──────────────────────────────────── */}
      <div className="flex flex-col overflow-hidden" style={{ height: isOwner ? '60%' : '100%' }}>

        {/* Header bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-4 py-3">
          <span className="text-xs font-medium uppercase tracking-widest text-content-secondary">
            Na żywo
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium text-content-secondary hover:text-brand-white transition-colors"
          >
            Zamknij
          </button>
        </div>

        {/* Player headers */}
        <div className="flex shrink-0 border-b border-border-subtle">
          <PlayerHeader
            name={top.playerName ?? 'Gracz 1'}
            remaining={p0Remaining}
            legsWon={legsWon[0]}
            setsWon={isMultiSet ? setsWon[0] : undefined}
            legAvg={currentLegAvg(rounds, 0)}
            matchAvg={matchAvg(completedLegs, rounds, 0)}
            isActive={activePlayer === 0}
            align="left"
            onClick={canToggleStart ? () => setStartPlayer(0) : undefined}
          />
          <div className="w-14 shrink-0 border-x border-border-subtle flex flex-col items-center justify-center py-3 gap-1">
            {canToggleStart ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4 text-brand-purple/50">
                <path d="M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4" />
              </svg>
            ) : (
              <span className="text-xs text-content-secondary">🎯</span>
            )}
          </div>
          <PlayerHeader
            name={bottom.playerName ?? 'Gracz 2'}
            remaining={p1Remaining}
            legsWon={legsWon[1]}
            setsWon={isMultiSet ? setsWon[1] : undefined}
            legAvg={currentLegAvg(rounds, 1)}
            matchAvg={matchAvg(completedLegs, rounds, 1)}
            isActive={activePlayer === 1}
            align="right"
            onClick={canToggleStart ? () => setStartPlayer(1) : undefined}
          />
        </div>

        {/* Scoreboard */}
        <div className="flex-1 overflow-y-auto">
          {rounds.map((round, i) => {
            const darts         = (i + 1) * 3;
            const showP1Preview = p1Pending && i === rounds.length - 1;
            const isEditRow     = editTarget?.roundIdx === i;
            const canEdit       = isOwner && phase === 'playing' && !isCpuTurn;

            return (
              <div key={i} className={`flex items-center border-b border-border-subtle/20 ${isEditRow ? 'bg-brand-purple/10' : ''}`}>
                <div className="flex flex-1 items-center justify-between px-3 py-2.5">
                  {round.p0 && (
                    <>
                      <button
                        type="button"
                        disabled={!canEdit}
                        onPointerDown={(e) => { e.preventDefault(); openEdit(i, 0); }}
                        className={[
                          'bg-transparent border-0 p-0 text-base font-semibold tabular-nums',
                          isEditRow && editTarget?.player === 0 ? 'text-brand-purple' : 'text-brand-white',
                          canEdit ? 'cursor-pointer hover:text-brand-purple' : 'cursor-default',
                        ].join(' ')}
                      >
                        {round.p0.score}
                      </button>
                      <span className="text-base tabular-nums text-content-secondary">
                        {round.p0.remaining}
                      </span>
                    </>
                  )}
                </div>

                <div className="w-14 shrink-0 border-x border-border-subtle flex items-center justify-center py-2.5">
                  <span className="text-sm tabular-nums text-content-secondary">{darts}</span>
                </div>

                <div className="flex flex-1 items-center justify-between px-3 py-2.5">
                  {round.p1 ? (
                    <>
                      <span className="text-base tabular-nums text-content-secondary">
                        {round.p1.remaining}
                      </span>
                      <button
                        type="button"
                        disabled={!canEdit}
                        onPointerDown={(e) => { e.preventDefault(); openEdit(i, 1); }}
                        className={[
                          'bg-transparent border-0 p-0 text-base font-semibold tabular-nums',
                          isEditRow && editTarget?.player === 1 ? 'text-brand-purple' : 'text-brand-white',
                          canEdit ? 'cursor-pointer hover:text-brand-purple' : 'cursor-default',
                        ].join(' ')}
                      >
                        {round.p1.score}
                      </button>
                    </>
                  ) : showP1Preview ? (
                    <>
                      <span className="text-base tabular-nums text-content-secondary opacity-50">
                        {p1Remaining - inputNum}
                      </span>
                      <span className="text-base font-semibold tabular-nums text-brand-purple opacity-60">
                        {inputNum}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}

          {p0Pending && (
            <div className="flex items-center border-b border-border-subtle/20 opacity-50">
              <div className="flex flex-1 items-center justify-between px-3 py-2.5">
                <span className="text-base font-semibold tabular-nums text-brand-purple">{inputNum}</span>
                <span className="text-base tabular-nums text-content-secondary">{p0Remaining - inputNum}</span>
              </div>
              <div className="w-14 shrink-0 border-x border-border-subtle flex items-center justify-center py-2.5">
                <span className="text-sm tabular-nums text-white/20">{(rounds.length + 1) * 3}</span>
              </div>
              <div className="flex-1" />
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {input !== '' && (
          <div className="shrink-0 flex items-baseline justify-center gap-3 border-t border-border-subtle/30 px-4 py-2.5">
            <span className={[
              'text-4xl font-black tabular-nums leading-none',
              isOverMax || editWouldCheckout ? 'text-red-400' : 'text-brand-white',
            ].join(' ')}>
              {inputNum}
            </span>
            {!isOverMax && !editWouldCheckout ? (
              <span className="text-lg tabular-nums text-content-secondary leading-none">
                → {effectiveMax - inputNum}
              </span>
            ) : (
              <span className="text-sm text-red-400 leading-none">
                {isOverMax ? `max ${effectiveMax}` : 'nie można zamknąć lega'}
              </span>
            )}
          </div>
        )}
      </div>

      {isOwner && (
        <>
          {/* Divider */}
          <div className="h-px shrink-0 bg-border-subtle" />

          {/* ── Bottom 40% — numpad or CPU thinking ──────────── */}
          <div className="flex flex-col gap-2 p-4" style={{ height: '40%' }}>
            {editTarget !== null && (
              <div className="flex shrink-0 items-center justify-between rounded-lg border border-brand-purple/30 bg-brand-purple/10 px-3 py-1.5">
                <span className="text-xs text-content-secondary">
                  Edycja: <span className="font-semibold text-brand-white">{playerName(editTarget.player)}</span>
                  {' · runda '}{editTarget.roundIdx + 1}
                  {' · stary wynik: '}
                  <span className="font-semibold text-brand-white">
                    {editTarget.player === 0
                      ? rounds[editTarget.roundIdx].p0?.score
                      : rounds[editTarget.roundIdx].p1?.score}
                  </span>
                </span>
                <button
                  type="button"
                  onPointerDown={(e) => { e.preventDefault(); setEditTarget(null); setInput(''); }}
                  className="ml-2 shrink-0 text-xs text-content-secondary hover:text-brand-white"
                >
                  Anuluj
                </button>
              </div>
            )}
            {isCpuTurn ? (
              <div className="flex flex-1 items-center justify-center">
                <span className="animate-pulse text-sm text-content-secondary">
                  {activeSlot.playerName ?? 'CPU'} rzuca…
                </span>
              </div>
            ) : (
              <>
                {rows.map((row, ri) => (
                  <div key={ri} className="grid grid-cols-3 gap-2 flex-1">
                    {row.map(({ label, onPress, variant }) => (
                      <NumKey
                        key={label}
                        label={label}
                        variant={variant}
                        onPress={onPress}
                        disabled={variant === 'ok' && !canConfirm}
                      />
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      )}

      {/* ── Leg / Set won overlay ─────────────────── */}
      {(phase === 'leg-won' || phase === 'set-won') && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-brand-black/95 px-8">
          <span className="text-xs font-medium uppercase tracking-widest text-content-secondary">
            {phase === 'set-won' ? 'Set dla' : 'Leg dla'}
          </span>
          <span className="mt-2 text-center text-4xl font-black text-brand-white">
            {playerName(legWinner)}
          </span>
          <span className="mt-3 text-2xl tabular-nums font-bold text-brand-purple">
            {overlayScore}
          </span>
          <div className="mt-10 flex gap-3 w-full max-w-xs">
            <button
              type="button"
              onClick={startNext}
              className="flex-1 rounded-xl bg-brand-purple/80 py-3 text-sm font-semibold text-brand-white hover:bg-brand-purple transition-colors"
            >
              {phase === 'set-won' ? 'Następny set' : 'Następny leg'}
            </button>
          </div>
        </div>
      )}

      {/* ── Match won: full summary screen ────────────────── */}
      {phase === 'match-won' && (
        <MatchSummaryScreen
          matchId={match.id}
          playerTop={top}
          playerBottom={bottom}
          completedLegs={completedLegs}
          legsWon={legsWon}
          setsWon={setsWon}
          isMultiSet={isMultiSet}
          onClose={onClose}
          onSave={isOwner ? finishMatch : undefined}
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PlayerHeader({
  name, remaining, legsWon, setsWon, legAvg, matchAvg, isActive, align, onClick,
}: {
  name: string; remaining: number; legsWon: number; setsWon?: number;
  legAvg: number; matchAvg: number;
  isActive: boolean; align: 'left' | 'right';
  onClick?: () => void;
}) {
  const scoreColor = isActive ? 'text-brand-white' : 'text-content-secondary';
  const scoreLabel = setsWon !== undefined ? `${setsWon} · ${legsWon}` : String(legsWon);
  return (
    <div
      onClick={onClick}
      className={[
        'flex flex-1 flex-col py-3 px-4 transition-colors duration-200',
        isActive ? 'bg-brand-purple/10' : 'opacity-60',
        onClick ? 'cursor-pointer hover:opacity-100 hover:bg-brand-purple/5' : '',
        align === 'right' ? 'items-end' : 'items-start',
      ].join(' ')}
    >
      <div className="flex w-full items-center justify-between">
        {align === 'right' ? (
          <>
            <span className="text-sm font-bold tabular-nums text-brand-purple shrink-0">{scoreLabel}</span>
            <span className={['truncate text-sm font-semibold tracking-wide', scoreColor].join(' ')}>{name}</span>
          </>
        ) : (
          <>
            <span className={['truncate text-sm font-semibold tracking-wide', scoreColor].join(' ')}>{name}</span>
            <span className="text-sm font-bold tabular-nums text-brand-purple shrink-0">{scoreLabel}</span>
          </>
        )}
      </div>
      <span className={[
        'text-6xl font-bold tabular-nums leading-tight mt-0.5 transition-colors',
        scoreColor,
      ].join(' ')}>
        {remaining}
      </span>
      {onClick && isActive && (
        <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-brand-purple">
          Zaczyna
        </span>
      )}
      <span className="text-base tabular-nums font-semibold leading-tight mt-1 text-brand-purple">
        {legAvg > 0 ? legAvg.toFixed(1) : '—'}
      </span>
      <span className="text-xs tabular-nums text-content-secondary leading-tight">
        {matchAvg > 0 ? matchAvg.toFixed(1) : '—'}
      </span>
    </div>
  );
}

function NumKey({
  label, variant, onPress, disabled = false,
}: {
  label: string; variant: KeyVar; onPress: () => void; disabled?: boolean;
}) {
  const base = 'flex items-center justify-center rounded-2xl text-2xl font-bold transition-colors active:scale-95';
  const styles: Record<KeyVar, string> = {
    digit: 'bg-white/5 text-brand-white hover:bg-white/10',
    clear: 'bg-red-950/70 text-red-400 hover:bg-red-900/70',
    ok:    'bg-brand-purple/80 text-brand-white hover:bg-brand-purple disabled:opacity-30',
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(e) => { e.preventDefault(); if (!disabled) onPress(); }}
      className={`${base} ${styles[variant]}`}
    >
      {label}
    </button>
  );
}
