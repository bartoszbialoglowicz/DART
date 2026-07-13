import { useState } from 'react';
import { GameShell } from '../game/GameShell';
import { PlayerHeader } from '../match/LiveMatchScreen/PlayerHeader';
import { DoubleModal } from '../match/LiveMatchScreen/DoubleModal';
import { NumKey, type KeyVar } from '../match/LiveMatchScreen/NumKey';
import type { DoubleModalPending } from '../match/LiveMatchScreen/useMatchEngine';
import { getCheckoutHint } from '../../utils/dart501';
import { currentLegAvg, matchAvg, computeMatchStats, type PlayerMatchStats } from '../../utils/statistics';
import type { DoubleAttempt, LegRecord, LegRound } from '../../types/bracket';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { cn } from '../ui/cn';

const START = 501;

// ── Session persistence ───────────────────────────────────────────────────────
// Survives a page refresh mid-game; cleared once the player leaves a finished game.

const SESSION_KEY = 'dart:501solo-session';

type Phase = 'playing' | 'leg-won' | 'game-over';

type Solo501Session = {
  legsTarget:    number;
  completedLegs: LegRecord[];
  rounds:        LegRound[];
  phase:         Phase;
};

export function loadSolo501Session(): Solo501Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Solo501Session) : null;
  } catch {
    return null;
  }
}

function saveSession(s: Solo501Session): void {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch {}
}

function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

type Props = {
  legsTarget: number;
  onBack:     () => void;
  onFinish:   (stats: PlayerMatchStats) => void;
};

export function Solo501Game({ legsTarget, onBack, onFinish }: Props) {
  const [initial] = useState<Solo501Session | null>(() => {
    const saved = loadSolo501Session();
    return saved && saved.legsTarget === legsTarget ? saved : null;
  });

  const [completedLegs, setCompletedLegs] = useState<LegRecord[]>(initial?.completedLegs ?? []);
  const [rounds,        setRounds]        = useState<LegRound[]>(initial?.rounds ?? []);
  const [phase,         setPhase]         = useState<Phase>(initial?.phase ?? 'playing');
  const [input,         setInput]         = useState('');
  const [doubleModalPending, setDoubleModalPending] = useState<DoubleModalPending | null>(null);
  const [statsSaved,    setStatsSaved]    = useState(false);

  function persist(next: Partial<Solo501Session>) {
    saveSession({
      legsTarget,
      completedLegs: next.completedLegs ?? completedLegs,
      rounds:        next.rounds        ?? rounds,
      phase:         next.phase         ?? phase,
    });
  }

  const remaining     = START - rounds.reduce((s, r) => s + (r.p0?.score ?? 0), 0);
  const inputNum      = input === '' ? 0 : Number(input);
  const effectiveMax  = Math.min(remaining, 180);
  const isOverMax     = input !== '' && inputNum > effectiveMax;
  const canConfirm    = input !== '' && !isOverMax;
  const legAvg        = currentLegAvg(rounds, 0);
  const sessionAvg    = matchAvg(completedLegs, rounds, 0);

  function pressDigit(d: string) {
    setInput(prev => {
      const next = prev + d;
      return next.length > 3 ? prev : next;
    });
  }

  function pressClear() {
    setInput('');
  }

  function applyScore(score: number, doubleAttempt?: DoubleAttempt) {
    const newRemaining = remaining - score;
    const newRounds: LegRound[] = [...rounds, { p0: { score, remaining: newRemaining, ...(doubleAttempt ? { doubleAttempt } : {}) } }];

    if (newRemaining === 0) {
      const legRecord: LegRecord = { rounds: newRounds, winner: 'top' };
      const newCompletedLegs = [...completedLegs, legRecord];
      const done = newCompletedLegs.length >= legsTarget;
      setRounds(newRounds);
      setCompletedLegs(newCompletedLegs);
      setPhase(done ? 'game-over' : 'leg-won');
      persist({ rounds: newRounds, completedLegs: newCompletedLegs, phase: done ? 'game-over' : 'leg-won' });
      if (done) saveStats(newCompletedLegs);
    } else {
      setRounds(newRounds);
      persist({ rounds: newRounds });
    }
  }

  function saveStats(legs: LegRecord[]) {
    if (statsSaved) return;
    setStatsSaved(true);
    const [stats] = computeMatchStats('501-solo', legs, ['Ty', '—'], [null, null]);
    onFinish(stats);
  }

  function confirmScore() {
    if (!canConfirm) return;
    const score = Number(input);
    setInput('');
    const isClosing = score === remaining;
    const inDoubleZone =
      isClosing ||
      (remaining <= 50 && (getCheckoutHint(remaining) !== null || remaining <= 40));
    if (inDoubleZone) {
      setDoubleModalPending({ score, remainingBefore: remaining, isClosing });
    } else {
      applyScore(score);
    }
  }

  function startNext() {
    setRounds([]);
    setInput('');
    setPhase('playing');
    persist({ rounds: [], phase: 'playing' });
  }

  function handleClose() {
    if (phase === 'game-over') clearSession();
    onBack();
  }

  type Key = { label: string; onPress: () => void; variant: KeyVar };
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
      { label: 'C',  onPress: pressClear,   variant: 'clear' },
      { label: '0',  onPress: () => pressDigit('0'), variant: 'digit' },
      { label: 'OK', onPress: confirmScore, variant: 'ok'    },
    ],
  ];

  return (
    <GameShell
      title="501 Solo"
      onClose={handleClose}
      badge={<Badge variant="accent">leg {Math.min(completedLegs.length + 1, legsTarget)}/{legsTarget}</Badge>}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 border-b border-border-subtle">
          <PlayerHeader
            name="Ty"
            remaining={remaining}
            legsWon={completedLegs.length}
            legAvg={legAvg}
            matchAvg={sessionAvg}
            isActive
            align="left"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {rounds.map((round, i) => (
            <div key={i} className="flex items-center border-b border-border-subtle">
              <div className="flex flex-1 items-center justify-between px-3 py-2.5">
                {round.p0 && (
                  <>
                    <span className="font-display text-xl font-bold tabular-nums text-content-primary">
                      {round.p0.score}
                    </span>
                    <span className="font-display text-xl tabular-nums text-content-secondary">
                      {round.p0.remaining}
                    </span>
                  </>
                )}
              </div>
              <div className="flex w-14 shrink-0 items-center justify-center border-l border-border-subtle py-2.5">
                <span className="font-display text-base tabular-nums text-content-secondary">{(i + 1) * 3}</span>
              </div>
            </div>
          ))}
        </div>

        {input !== '' && (
          <div className="flex shrink-0 items-baseline justify-center gap-3 border-t border-border-subtle px-4 py-2.5">
            <span className={cn(
              'font-display text-4xl font-extrabold tabular-nums leading-none',
              isOverMax ? 'text-score-down-text' : 'text-content-primary',
            )}>
              {inputNum}
            </span>
            {!isOverMax ? (
              <span className="font-display text-lg tabular-nums leading-none text-content-secondary">
                → {effectiveMax - inputNum}
              </span>
            ) : (
              <span className="text-sm leading-none text-score-down-text">max {effectiveMax}</span>
            )}
          </div>
        )}
      </div>

      <div className="h-px shrink-0 bg-border-subtle" />
      <div className="flex h-2/5 flex-col gap-2 p-4">
        {rows.map((row, ri) => (
          <div key={ri} className="grid flex-1 grid-cols-3 gap-2">
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
      </div>

      {phase === 'leg-won' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-surface-base px-8">
          <span className="text-xs font-medium uppercase tracking-widest text-content-secondary">Leg ukończony</span>
          <span className="mt-2 font-display text-2xl font-bold tabular-nums text-content-accent">
            {completedLegs.length}/{legsTarget}
          </span>
          <div className="mt-10 flex w-full max-w-xs gap-3">
            <Button variant="primary" size="lg" fullWidth onClick={startNext}>Następny leg</Button>
          </div>
        </div>
      )}

      {doubleModalPending && (
        <DoubleModal
          state={doubleModalPending}
          playerName="Ty"
          onConfirm={(dartsAtDouble, dartsToClose) => {
            applyScore(doubleModalPending.score, { dartsAtDouble, dartsToClose });
            setDoubleModalPending(null);
          }}
          onSkip={() => {
            applyScore(doubleModalPending.score);
            setDoubleModalPending(null);
          }}
        />
      )}

      {phase === 'game-over' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-surface-base px-8">
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-widest text-score-up-text">Sesja ukończona</p>
            <p className="mt-2 font-display text-5xl font-extrabold tabular-nums text-content-primary">
              {sessionAvg > 0 ? sessionAvg.toFixed(1) : '—'}
            </p>
            <p className="mt-1 text-sm text-content-secondary">średnia</p>
          </div>
          <div className="grid w-full max-w-xs grid-cols-2 gap-3">
            <div className="rounded-xl bg-surface-overlay p-3 text-center">
              <p className="text-xs text-content-secondary">Legi</p>
              <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-content-primary">{legsTarget}</p>
            </div>
            <div className="rounded-xl bg-surface-overlay p-3 text-center">
              <p className="text-xs text-content-secondary">Lotki/leg</p>
              <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-content-primary">
                {(completedLegs.reduce((s, l) => s + l.rounds.length, 0) * 3 / Math.max(1, completedLegs.length)).toFixed(1)}
              </p>
            </div>
          </div>
          <div className="flex w-full max-w-xs gap-3">
            <Button variant="secondary" fullWidth onClick={handleClose}>Zamknij</Button>
          </div>
        </div>
      )}
    </GameShell>
  );
}
