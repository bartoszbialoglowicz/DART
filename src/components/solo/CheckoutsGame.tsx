import { useEffect, useRef, useState } from 'react';
import { getCheckoutHint } from '../../utils/dart501';
import { GameShell } from '../game/GameShell';
import { GameKey } from '../game/GameKey';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { cn } from '../ui/cn';

const MIN_VALUE = 40;

export type CheckoutsMode = 'easy' | 'hard';

type DartsUsed = 1 | 2 | 3;
type Attempt   = { value: number; darts: DartsUsed | null };

// ── Session persistence ───────────────────────────────────────────────────────
// Survives a page refresh mid-game; cleared once the player leaves a finished game.

const SESSION_KEY = 'dart:checkouts-session';

type CheckoutsSession = {
  mode:         CheckoutsMode;
  currentValue: number;
  history:      Attempt[];
  streak:       number;
  bestStreak:   number;
  successCount: number;
  phase:        'playing' | 'game-over';
};

export function loadCheckoutsSession(): CheckoutsSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as CheckoutsSession) : null;
  } catch {
    return null;
  }
}

function saveSession(s: CheckoutsSession): void {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch {}
}

function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

type Props = {
  mode:   CheckoutsMode;
  onBack: () => void;
};

export function CheckoutsGame({ mode, onBack }: Props) {
  const [initial] = useState<CheckoutsSession | null>(() => {
    const saved = loadCheckoutsSession();
    return saved && saved.mode === mode ? saved : null;
  });
  const [currentValue, setCurrentValue] = useState(initial?.currentValue ?? MIN_VALUE);
  const [history,      setHistory]      = useState<Attempt[]>(initial?.history ?? []);
  const [streak,       setStreak]       = useState(initial?.streak ?? 0);
  const [bestStreak,   setBestStreak]   = useState(initial?.bestStreak ?? 0);
  const [successCount, setSuccessCount] = useState(initial?.successCount ?? 0);
  const [phase,        setPhase]        = useState<'playing' | 'game-over'>(initial?.phase ?? 'playing');
  const [delta,        setDelta]        = useState<number | null>(null);
  const deltaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    saveSession({ mode, currentValue, history, streak, bestStreak, successCount, phase });
  }, [mode, currentValue, history, streak, bestStreak, successCount, phase]);

  function showDelta(val: number) {
    if (deltaTimerRef.current) clearTimeout(deltaTimerRef.current);
    setDelta(val);
    deltaTimerRef.current = setTimeout(() => setDelta(null), 750);
  }

  useEffect(() => () => { if (deltaTimerRef.current) clearTimeout(deltaTimerRef.current); }, []);

  function submit(darts: DartsUsed | null) {
    const attempt: Attempt = { value: currentValue, darts };
    setHistory(prev => [...prev, attempt]);

    if (darts !== null) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      setBestStreak(prev => Math.max(prev, newStreak));
      setSuccessCount(prev => prev + 1);
      setCurrentValue(prev => prev + 10);
      showDelta(+10);
    } else {
      setStreak(0);
      if (mode === 'hard' && currentValue === MIN_VALUE) {
        setPhase('game-over');
      } else {
        const next = Math.max(MIN_VALUE, currentValue - 1);
        setCurrentValue(next);
        if (next < currentValue) showDelta(-1);
      }
    }
  }

  function finishNow() {
    if (phase !== 'playing') return;
    setPhase('game-over');
  }

  function restart() {
    setCurrentValue(MIN_VALUE);
    setHistory([]);
    setStreak(0);
    setBestStreak(0);
    setSuccessCount(0);
    setPhase('playing');
    setDelta(null);
  }

  // Header close / overlay "Wróć": preserve an in-progress game for resume, but
  // clear a finished one so the next visit starts fresh instead of re-showing it.
  function handleClose() {
    if (phase === 'game-over') clearSession();
    onBack();
  }

  const hint          = getCheckoutHint(currentValue);
  const totalAttempts = history.length;
  const recentHistory = [...history].reverse().slice(0, 10);
  const hitRate       = totalAttempts > 0 ? Math.round((successCount / totalAttempts) * 100) : 0;

  return (
    <GameShell
      title="Checkouts"
      onClose={handleClose}
      badge={<Badge variant={mode === 'hard' ? 'down' : 'accent'} className="uppercase">{mode}</Badge>}
      extraAction={phase === 'playing' && totalAttempts > 0 && (
        <Button variant="secondary" size="sm" onClick={finishNow}>Zakończ</Button>
      )}
    >
      {/* ── Value display ────────────────────────────────────── */}
      <div className="flex shrink-0 flex-col items-center gap-1 pb-3 pt-6">
        <span className="text-xs font-medium uppercase tracking-widest text-content-secondary">
          zamknij
        </span>

        <div className="flex items-start gap-3">
          <span className="font-display text-9xl font-extrabold leading-none tabular-nums text-content-primary">
            {currentValue}
          </span>
          {delta !== null && (
            <span className={cn(
              'mt-2 font-display text-xl font-bold leading-none tabular-nums',
              delta > 0 ? 'text-score-up-text' : 'text-score-down-text',
            )}>
              {delta > 0 ? `+${delta}` : delta}
            </span>
          )}
        </div>

        {hint && (
          <span className="text-3xl font-bold tracking-wide text-content-accent">
            {hint}
          </span>
        )}

        <div className="mt-2 flex gap-5 text-xs text-content-secondary">
          <span>seria <span className="font-bold text-content-primary">{streak}</span></span>
          <span>rekord <span className="font-bold text-content-primary">{bestStreak}</span></span>
          <span>
            <span className="font-bold text-content-primary">{successCount}</span>
            <span>/{totalAttempts}</span>
            {totalAttempts > 0 && (
              <span className="ml-1 text-content-accent">({hitRate}%)</span>
            )}
          </span>
        </div>
      </div>

      {/* ── History ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        <div className="flex flex-col gap-1">
          {recentHistory.map((a, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2',
                i === 0 ? 'bg-surface-muted' : 'bg-surface-overlay',
              )}
            >
              <span className={cn(
                'w-4 shrink-0 text-center text-sm font-bold',
                a.darts !== null ? 'text-score-up-text' : 'text-score-down-text',
              )}>
                {a.darts !== null ? '✓' : '✗'}
              </span>
              <span className="w-12 shrink-0 font-display text-sm font-bold tabular-nums text-content-primary">
                {a.value}
              </span>
              {a.darts !== null ? (
                <span className="text-xs text-content-secondary">
                  {a.darts} {dartsLabel(a.darts)}
                </span>
              ) : (
                <span className="text-xs text-score-down-text">brak</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Keys ─────────────────────────────────────────────── */}
      <div className="flex shrink-0 flex-col gap-2 p-4 pb-8">
        <div className="grid grid-cols-3 gap-2">
          {([1, 2, 3] as DartsUsed[]).map(n => (
            <GameKey
              key={n}
              tone="neutral"
              label={n}
              sublabel={dartsLabel(n)}
              onPointerDown={(e) => { e.preventDefault(); if (phase === 'playing') submit(n); }}
            />
          ))}
        </div>
        <GameKey
          tone="danger"
          className="py-6"
          onPointerDown={(e) => { e.preventDefault(); if (phase === 'playing') submit(null); }}
        >
          <span className="text-xl font-semibold">Brak trafienia</span>
        </GameKey>
      </div>

      {/* ── Game-over overlay ─────────────────────────────────── */}
      {phase === 'game-over' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-surface-base px-8">
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-widest text-score-down-text">
              Koniec gry
            </p>
            <p className="mt-2 font-display text-5xl font-extrabold tabular-nums text-content-primary">
              {successCount}
            </p>
            <p className="mt-1 text-sm text-content-secondary">
              {successCount === 1 ? 'checkout' : 'checkouty'}
            </p>
          </div>

          <div className="grid w-full max-w-xs grid-cols-2 gap-3">
            {[
              { label: 'Skuteczność',     value: `${hitRate}%` },
              { label: 'Najlepsza seria', value: String(bestStreak) },
              { label: 'Prób',            value: String(totalAttempts) },
              {
                label: 'Najwyższy',
                value: String(history.reduce((m, a) => a.darts !== null ? Math.max(m, a.value) : m, MIN_VALUE)),
              },
            ].map(s => (
              <div key={s.label} className="rounded-xl bg-surface-overlay p-3 text-center">
                <p className="text-xs text-content-secondary">{s.label}</p>
                <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-content-primary">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="flex w-full max-w-xs gap-3">
            <Button variant="primary" fullWidth onClick={restart}>Jeszcze raz</Button>
            <Button variant="secondary" fullWidth onClick={handleClose}>Wróć</Button>
          </div>
        </div>
      )}
    </GameShell>
  );
}

function dartsLabel(n: number): string {
  if (n === 1) return 'lotka';
  if (n < 5)   return 'lotki';
  return 'lotek';
}
