import { useEffect, useRef, useState } from 'react';
import { getCheckoutHint } from '../../utils/dart501';

const MIN_VALUE = 40;

type DartsUsed = 1 | 2 | 3;
type Attempt   = { value: number; darts: DartsUsed | null };

type Props = {
  mode:   'easy' | 'hard';
  onBack: () => void;
};

export function CheckoutsGame({ mode, onBack }: Props) {
  const [currentValue, setCurrentValue] = useState(MIN_VALUE);
  const [history,      setHistory]      = useState<Attempt[]>([]);
  const [streak,       setStreak]       = useState(0);
  const [bestStreak,   setBestStreak]   = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [phase,        setPhase]        = useState<'playing' | 'game-over'>('playing');
  const [delta,        setDelta]        = useState<number | null>(null);
  const deltaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  function restart() {
    setCurrentValue(MIN_VALUE);
    setHistory([]);
    setStreak(0);
    setBestStreak(0);
    setSuccessCount(0);
    setPhase('playing');
    setDelta(null);
  }

  const hint          = getCheckoutHint(currentValue);
  const totalAttempts = history.length;
  const recentHistory = [...history].reverse().slice(0, 10);
  const hitRate       = totalAttempts > 0 ? Math.round((successCount / totalAttempts) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-brand-black select-none">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-widest text-content-secondary">
            Checkouts
          </span>
          <span className={[
            'rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest',
            mode === 'hard'
              ? 'bg-red-950/60 text-red-400'
              : 'bg-brand-purple/20 text-brand-purple',
          ].join(' ')}>
            {mode}
          </span>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium text-content-secondary hover:text-brand-white transition-colors"
        >
          Zamknij
        </button>
      </div>

      {/* ── Value display ────────────────────────────────────── */}
      <div className="shrink-0 flex flex-col items-center pt-6 pb-3 gap-1">
        <span className="text-[10px] font-medium uppercase tracking-widest text-content-secondary">
          zamknij
        </span>

        <div className="flex items-start gap-3">
          <span className="text-9xl font-black tabular-nums text-brand-white leading-none">
            {currentValue}
          </span>
          {delta !== null && (
            <span className={[
              'text-xl font-bold tabular-nums mt-2 leading-none',
              delta > 0 ? 'text-green-400' : 'text-red-400',
            ].join(' ')}>
              {delta > 0 ? `+${delta}` : delta}
            </span>
          )}
        </div>

        {hint && (
          <span className="text-base font-semibold text-brand-purple tracking-widest">
            {hint}
          </span>
        )}

        <div className="flex gap-5 mt-2 text-xs text-content-secondary">
          <span>seria <span className="font-bold text-brand-white">{streak}</span></span>
          <span>rekord <span className="font-bold text-brand-white">{bestStreak}</span></span>
          <span>
            <span className="font-bold text-brand-white">{successCount}</span>
            <span>/{totalAttempts}</span>
            {totalAttempts > 0 && (
              <span className="ml-1 text-brand-purple/70">({hitRate}%)</span>
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
              className={[
                'flex items-center gap-3 rounded-lg px-3 py-2',
                i === 0 ? 'bg-white/8' : 'bg-white/3',
              ].join(' ')}
            >
              <span className={[
                'w-4 shrink-0 text-center text-sm font-bold',
                a.darts !== null ? 'text-green-400' : 'text-red-400',
              ].join(' ')}>
                {a.darts !== null ? '✓' : '✗'}
              </span>
              <span className="w-12 shrink-0 text-sm font-bold tabular-nums text-brand-white">
                {a.value}
              </span>
              {a.darts !== null ? (
                <span className="text-xs text-content-secondary">
                  {a.darts} {dartsLabel(a.darts)}
                </span>
              ) : (
                <span className="text-xs text-red-400/60">brak</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Buttons ──────────────────────────────────────────── */}
      <div className="shrink-0 p-4 flex flex-col gap-2">
        <div className="grid grid-cols-3 gap-2">
          {([1, 2, 3] as DartsUsed[]).map(n => (
            <button
              key={n}
              type="button"
              onPointerDown={(e) => { e.preventDefault(); if (phase === 'playing') submit(n); }}
              className="flex flex-col items-center justify-center rounded-2xl bg-brand-purple/80 py-5 text-brand-white hover:bg-brand-purple active:scale-95 transition-colors"
            >
              <span className="text-3xl font-black leading-none">{n}</span>
              <span className="text-[10px] mt-1 font-medium uppercase tracking-wider opacity-70">
                {dartsLabel(n)}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onPointerDown={(e) => { e.preventDefault(); if (phase === 'playing') submit(null); }}
          className="rounded-2xl bg-white/5 py-5 text-xl font-semibold text-content-secondary hover:bg-white/10 hover:text-brand-white active:scale-95 transition-colors"
        >
          Brak trafienia
        </button>
      </div>

      {/* ── Game-over overlay ─────────────────────────────────── */}
      {phase === 'game-over' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-brand-black/97 px-8 gap-6">
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-widest text-red-400">
              Koniec gry
            </p>
            <p className="mt-2 text-5xl font-black text-brand-white tabular-nums">
              {successCount}
            </p>
            <p className="text-sm text-content-secondary mt-1">
              {successCount === 1 ? 'checkout' : 'checkouty'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
            {[
              { label: 'Skuteczność',    value: `${hitRate}%` },
              { label: 'Najlepsza seria', value: String(bestStreak) },
              { label: 'Prób',           value: String(totalAttempts) },
              {
                label: 'Najwyższy',
                value: String(history.reduce((m, a) => a.darts !== null ? Math.max(m, a.value) : m, MIN_VALUE)),
              },
            ].map(s => (
              <div key={s.label} className="rounded-xl bg-white/5 p-3 text-center">
                <p className="text-xs text-content-secondary">{s.label}</p>
                <p className="mt-1 text-2xl font-black text-brand-white">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-3 w-full max-w-xs">
            <button
              type="button"
              onClick={restart}
              className="flex-1 rounded-xl bg-brand-purple/80 py-3 text-sm font-semibold text-brand-white hover:bg-brand-purple transition-colors"
            >
              Jeszcze raz
            </button>
            <button
              type="button"
              onClick={onBack}
              className="flex-1 rounded-xl border border-border-subtle py-3 text-sm font-medium text-content-secondary hover:text-brand-white transition-colors"
            >
              Wróć
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function dartsLabel(n: number): string {
  if (n === 1) return 'lotka';
  if (n < 5)   return 'lotki';
  return 'lotek';
}
