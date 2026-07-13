import { useState } from 'react';
import { GameShell } from '../game/GameShell';
import { GameKey } from '../game/GameKey';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { cn } from '../ui/cn';

const SESSION_KEY = 'dart:sector-practice-session';

type ThrowResult = 'single' | 'double' | 'triple' | 'miss';
type Throw       = { result: ThrowResult; points: number };
type Phase       = 'playing' | 'game-over';

type SectorPracticeSessionState = {
  sector:     string;
  dartsLimit: number;
  throws:     Throw[];
  phase:      Phase;
};

export function loadSectorPracticeSession(): SectorPracticeSessionState | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SectorPracticeSessionState) : null;
  } catch {
    return null;
  }
}

function saveSession(s: SectorPracticeSessionState): void {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch {}
}

function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

function sectorValue(sector: string): number {
  return sector === 'BULL' ? 25 : Number(sector);
}

type Props = {
  sector:     string;
  dartsLimit: number;
  onBack:     () => void;
  onFinish:   (hitRate: number, score: number) => void;
};

export function SectorPracticeGame({ sector, dartsLimit, onBack, onFinish }: Props) {
  const [initial] = useState<SectorPracticeSessionState | null>(() => {
    const saved = loadSectorPracticeSession();
    return saved && saved.sector === sector && saved.dartsLimit === dartsLimit ? saved : null;
  });

  const [throws, setThrows] = useState<Throw[]>(initial?.throws ?? []);
  const [phase,  setPhase]  = useState<Phase>(initial?.phase ?? 'playing');
  const [statsSaved, setStatsSaved] = useState(false);

  const isBull       = sector === 'BULL';
  const value        = sectorValue(sector);
  const dartsThrown  = throws.length;
  const hits         = throws.filter(t => t.result !== 'miss').length;
  const hitRate      = dartsThrown > 0 ? (hits / dartsThrown) * 100 : 0;
  const score        = throws.reduce((s, t) => s + t.points, 0);

  function persist(next: Partial<SectorPracticeSessionState>) {
    saveSession({
      sector,
      dartsLimit,
      throws: next.throws ?? throws,
      phase:  next.phase  ?? phase,
    });
  }

  function pointsFor(result: ThrowResult): number {
    if (result === 'miss') return 0;
    if (result === 'single') return value;
    if (result === 'double') return value * 2;
    return value * 3; // triple — never reachable for BULL, button is disabled
  }

  function submit(result: ThrowResult) {
    if (phase !== 'playing') return;
    const newThrows = [...throws, { result, points: pointsFor(result) }];
    const done = newThrows.length >= dartsLimit;
    setThrows(newThrows);

    if (done) {
      setPhase('game-over');
      persist({ throws: newThrows, phase: 'game-over' });
      if (!statsSaved) {
        setStatsSaved(true);
        const finalHits = newThrows.filter(t => t.result !== 'miss').length;
        const finalHitRate = (finalHits / newThrows.length) * 100;
        const finalScore = newThrows.reduce((s, t) => s + t.points, 0);
        onFinish(finalHitRate, finalScore);
      }
    } else {
      persist({ throws: newThrows });
    }
  }

  function handleClose() {
    if (phase === 'game-over') clearSession();
    onBack();
  }

  const recentThrows = [...throws].reverse().slice(0, 12);

  return (
    <GameShell
      title="Jeden sektor"
      onClose={handleClose}
      badge={<Badge variant="accent">{Math.min(dartsThrown + 1, dartsLimit)}/{dartsLimit} lotek</Badge>}
    >
      <div className="flex shrink-0 flex-col items-center gap-1 pb-3 pt-6">
        <span className="text-xs font-medium uppercase tracking-widest text-content-secondary">
          sektor
        </span>
        <span className="font-display text-6xl font-extrabold leading-none tabular-nums text-content-accent">
          {isBull ? 'BULL' : sector}
        </span>

        <div className="mt-4 flex gap-6 text-center">
          <div>
            <p className="font-display text-3xl font-bold tabular-nums text-content-primary">
              {hitRate.toFixed(0)}%
            </p>
            <p className="text-xs text-content-secondary">trafień</p>
          </div>
          <div>
            <p className="font-display text-3xl font-bold tabular-nums text-content-primary">
              {score}
            </p>
            <p className="text-xs text-content-secondary">score</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        <div className="flex flex-col gap-1">
          {recentThrows.map((t, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center justify-between rounded-lg px-3 py-2',
                i === 0 ? 'bg-surface-muted' : 'bg-surface-overlay',
              )}
            >
              <span className={cn(
                'text-xs font-semibold uppercase tracking-wide',
                t.result === 'miss' ? 'text-score-down-text' : 'text-score-up-text',
              )}>
                {throwLabel(t.result)}
              </span>
              <span className="font-display text-sm font-bold tabular-nums text-content-primary">
                {t.points > 0 ? `+${t.points}` : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-2 p-4 pb-8">
        <div className="grid grid-cols-3 gap-2">
          <GameKey
            tone="neutral"
            className="py-5"
            onPointerDown={(e) => { e.preventDefault(); submit('single'); }}
          >
            <span className="text-xl font-semibold">Single</span>
          </GameKey>
          <GameKey
            tone="neutral"
            className="py-5"
            onPointerDown={(e) => { e.preventDefault(); submit('double'); }}
          >
            <span className="text-xl font-semibold">Double</span>
          </GameKey>
          <GameKey
            tone="neutral"
            className="py-5"
            disabled={isBull}
            onPointerDown={(e) => { e.preventDefault(); submit('triple'); }}
          >
            <span className="text-xl font-semibold">Triple</span>
          </GameKey>
        </div>
        <GameKey
          tone="danger"
          className="py-6"
          onPointerDown={(e) => { e.preventDefault(); submit('miss'); }}
        >
          <span className="text-xl font-semibold">Miss</span>
        </GameKey>
      </div>

      {phase === 'game-over' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-surface-base px-8">
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-widest text-score-up-text">
              Sesja ukończona
            </p>
            <p className="mt-2 font-display text-5xl font-extrabold tabular-nums text-content-primary">
              {score}
            </p>
            <p className="mt-1 text-sm text-content-secondary">
              punktów · sektor {isBull ? 'Bull' : sector}
            </p>
          </div>

          <div className="grid w-full max-w-xs grid-cols-2 gap-3">
            <div className="rounded-xl bg-surface-overlay p-3 text-center">
              <p className="text-xs text-content-secondary">% trafień</p>
              <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-content-primary">
                {hitRate.toFixed(0)}%
              </p>
            </div>
            <div className="rounded-xl bg-surface-overlay p-3 text-center">
              <p className="text-xs text-content-secondary">Lotki</p>
              <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-content-primary">
                {dartsLimit}
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

function throwLabel(result: ThrowResult): string {
  if (result === 'single') return 'Single';
  if (result === 'double') return 'Double';
  if (result === 'triple') return 'Triple';
  return 'Miss';
}
