import { useEffect, useRef, useState } from 'react';
import { GameShell } from '../game/GameShell';
import { GameKey } from '../game/GameKey';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { cn } from '../ui/cn';

const START_SCORE = 27;

type Target = { label: string; value: number };
type Hits   = 0 | 1 | 2 | 3;
type Round  = { target: string; hits: Hits; delta: number };

const TARGETS: Target[] = [
  ...Array.from({ length: 20 }, (_, i) => ({ label: `D${i + 1}`, value: (i + 1) * 2 })),
  { label: 'BULL', value: 50 },
];

// ── Session persistence ───────────────────────────────────────────────────────
// Survives a page refresh mid-game; cleared once the player leaves a finished game.

const SESSION_KEY = 'dart:bob27-session';

type Bob27Session = {
  targetIndex: number;
  score:       number;
  history:     Round[];
  phase:       'playing' | 'game-over';
  busted:      boolean;
};

function loadSession(): Bob27Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Bob27Session) : null;
  } catch {
    return null;
  }
}

function saveSession(s: Bob27Session): void {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch {}
}

function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

type Props = {
  onBack: () => void;
};

export function Bob27Game({ onBack }: Props) {
  const [initial]      = useState<Bob27Session | null>(() => loadSession());
  const [targetIndex, setTargetIndex] = useState(initial?.targetIndex ?? 0);
  const [score,        setScore]      = useState(initial?.score ?? START_SCORE);
  const [history,      setHistory]    = useState<Round[]>(initial?.history ?? []);
  const [phase,        setPhase]      = useState<'playing' | 'game-over'>(initial?.phase ?? 'playing');
  const [busted,       setBusted]     = useState(initial?.busted ?? false);
  const [delta,        setDelta]      = useState<number | null>(null);
  const deltaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    saveSession({ targetIndex, score, history, phase, busted });
  }, [targetIndex, score, history, phase, busted]);

  function showDelta(val: number) {
    if (deltaTimerRef.current) clearTimeout(deltaTimerRef.current);
    setDelta(val);
    deltaTimerRef.current = setTimeout(() => setDelta(null), 750);
  }

  useEffect(() => () => { if (deltaTimerRef.current) clearTimeout(deltaTimerRef.current); }, []);

  const target = TARGETS[targetIndex];

  function submit(hits: Hits) {
    const roundDelta = hits > 0 ? hits * target.value : -target.value;
    const newScore   = score + roundDelta;

    setHistory(prev => [...prev, { target: target.label, hits, delta: roundDelta }]);
    setScore(newScore);
    showDelta(roundDelta);

    if (newScore <= 0) {
      setBusted(true);
      setPhase('game-over');
      return;
    }

    if (targetIndex === TARGETS.length - 1) {
      setPhase('game-over');
      return;
    }

    setTargetIndex(prev => prev + 1);
  }

  function restart() {
    setTargetIndex(0);
    setScore(START_SCORE);
    setHistory([]);
    setPhase('playing');
    setBusted(false);
    setDelta(null);
  }

  // Header close / overlay "Wróć": preserve an in-progress game for resume, but
  // clear a finished one so the next visit starts fresh instead of re-showing it.
  function handleClose() {
    if (phase === 'game-over') clearSession();
    onBack();
  }

  const totalRounds = history.length;
  const totalHits    = history.reduce((sum, r) => sum + r.hits, 0);
  const totalDarts   = totalRounds * 3;
  const hitRate      = totalDarts > 0 ? Math.round((totalHits / totalDarts) * 100) : 0;
  const recentHistory = [...history].reverse().slice(0, 10);

  return (
    <GameShell
      title="Bob's 27"
      onClose={handleClose}
      badge={<Badge variant="accent">{Math.min(targetIndex + 1, TARGETS.length)}/{TARGETS.length}</Badge>}
    >
      {/* ── Score display ─────────────────────────────────────── */}
      <div className="flex shrink-0 flex-col items-center gap-1 pb-3 pt-6">
        <span className="text-xs font-medium uppercase tracking-widest text-content-secondary">
          wynik
        </span>

        <div className="flex items-start gap-3">
          <span className="font-display text-9xl font-extrabold leading-none tabular-nums text-content-primary">
            {score}
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

        {phase === 'playing' && (
          <span className="text-3xl font-bold tracking-wide text-content-accent">
            {target.label} · trafienie = +{target.value}
          </span>
        )}

        <div className="mt-2 flex gap-5 text-xs text-content-secondary">
          <span>rund <span className="font-bold text-content-primary">{totalRounds}</span></span>
          <span>
            <span className="font-bold text-content-primary">{totalHits}</span>
            <span>/{totalDarts}</span>
            {totalDarts > 0 && (
              <span className="ml-1 text-content-accent">({hitRate}%)</span>
            )}
          </span>
        </div>
      </div>

      {/* ── History ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        <div className="flex flex-col gap-1">
          {recentHistory.map((r, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2',
                i === 0 ? 'bg-surface-muted' : 'bg-surface-overlay',
              )}
            >
              <span className={cn(
                'w-4 shrink-0 text-center text-sm font-bold',
                r.hits > 0 ? 'text-score-up-text' : 'text-score-down-text',
              )}>
                {r.hits > 0 ? '✓' : '✗'}
              </span>
              <span className="w-14 shrink-0 font-display text-sm font-bold tabular-nums text-content-primary">
                {r.target}
              </span>
              <span className="text-xs text-content-secondary">
                {r.hits}/3 {hitsLabel(r.hits)}
              </span>
              <span className={cn(
                'ml-auto font-display text-sm font-bold tabular-nums',
                r.delta > 0 ? 'text-score-up-text' : 'text-score-down-text',
              )}>
                {r.delta > 0 ? `+${r.delta}` : r.delta}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Keys ─────────────────────────────────────────────── */}
      <div className="flex shrink-0 flex-col gap-2 p-4 pb-8">
        <div className="grid grid-cols-3 gap-2">
          {([1, 2, 3] as Hits[]).map(n => (
            <GameKey
              key={n}
              tone="neutral"
              label={n}
              sublabel={hitsLabel(n)}
              onPointerDown={(e) => { e.preventDefault(); if (phase === 'playing') submit(n); }}
            />
          ))}
        </div>
        <GameKey
          tone="danger"
          className="py-6"
          onPointerDown={(e) => { e.preventDefault(); if (phase === 'playing') submit(0); }}
        >
          <span className="text-xl font-semibold">Brak trafień</span>
        </GameKey>
      </div>

      {/* ── Game-over overlay ─────────────────────────────────── */}
      {phase === 'game-over' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-surface-base px-8">
          <div className="text-center">
            <p className={cn(
              'text-xs font-medium uppercase tracking-widest',
              busted ? 'text-score-down-text' : 'text-score-up-text',
            )}>
              {busted ? 'Wyzerowano wynik' : 'Zegar ukończony'}
            </p>
            <p className="mt-2 font-display text-5xl font-extrabold tabular-nums text-content-primary">
              {score}
            </p>
            <p className="mt-1 text-sm text-content-secondary">punktów</p>
          </div>

          <div className="grid w-full max-w-xs grid-cols-2 gap-3">
            {[
              { label: 'Skuteczność', value: `${hitRate}%` },
              { label: 'Rund',        value: String(totalRounds) },
              { label: 'Trafień',     value: `${totalHits}/${totalDarts}` },
              { label: 'Dotarłeś do', value: busted ? target.label : 'BULL' },
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

function hitsLabel(n: number): string {
  return n === 1 ? 'trafienie' : 'trafienia';
}
