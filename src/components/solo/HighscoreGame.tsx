import { useState } from 'react';
import { GameShell } from '../game/GameShell';
import { NumKey, type KeyVar } from '../match/LiveMatchScreen/NumKey';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { cn } from '../ui/cn';

// ── Session persistence ───────────────────────────────────────────────────────
// Survives a page refresh mid-game; cleared once the player leaves a finished game.

const SESSION_KEY = 'dart:highscore-session';

type Visit = { score: number; darts: number };
type Phase = 'playing' | 'game-over';

type HighscoreSession = {
  dartsTarget: number;
  visits:      Visit[];
  phase:       Phase;
};

export function loadHighscoreSession(): HighscoreSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as HighscoreSession) : null;
  } catch {
    return null;
  }
}

function saveSession(s: HighscoreSession): void {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch {}
}

function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

type Props = {
  dartsTarget:   number;
  personalBest:  number | null;
  onBack:        () => void;
  onFinish:      (score: number) => void;
};

export function HighscoreGame({ dartsTarget, personalBest, onBack, onFinish }: Props) {
  const [initial] = useState<HighscoreSession | null>(() => {
    const saved = loadHighscoreSession();
    return saved && saved.dartsTarget === dartsTarget ? saved : null;
  });

  const [visits, setVisits] = useState<Visit[]>(initial?.visits ?? []);
  const [phase,  setPhase]  = useState<Phase>(initial?.phase ?? 'playing');
  const [input,  setInput]  = useState('');
  const [statsSaved, setStatsSaved] = useState(false);

  const dartsThrown    = visits.reduce((s, v) => s + v.darts, 0);
  const dartsRemaining = dartsTarget - dartsThrown;
  const dartsThisVisit = Math.min(3, dartsRemaining);
  const maxThisVisit    = dartsThisVisit * 60;
  const score           = visits.reduce((s, v) => s + v.score, 0);
  const inputNum        = input === '' ? 0 : Number(input);
  const isOverMax        = input !== '' && inputNum > maxThisVisit;
  const canConfirm        = input !== '' && !isOverMax;
  const isNewBest         = personalBest !== null && score > personalBest;

  function persist(next: Partial<HighscoreSession>) {
    saveSession({
      dartsTarget,
      visits: next.visits ?? visits,
      phase:  next.phase  ?? phase,
    });
  }

  function pressDigit(d: string) {
    setInput(prev => {
      const next = prev + d;
      return next.length > 3 ? prev : next;
    });
  }

  function pressClear() {
    setInput('');
  }

  function confirmScore() {
    if (!canConfirm) return;
    const visitScore = Number(input);
    setInput('');
    const newVisits = [...visits, { score: visitScore, darts: dartsThisVisit }];
    const newDartsThrown = dartsThrown + dartsThisVisit;
    setVisits(newVisits);

    if (newDartsThrown >= dartsTarget) {
      setPhase('game-over');
      persist({ visits: newVisits, phase: 'game-over' });
      if (!statsSaved) {
        setStatsSaved(true);
        onFinish(newVisits.reduce((s, v) => s + v.score, 0));
      }
    } else {
      persist({ visits: newVisits });
    }
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

  const recentVisits = [...visits].reverse().slice(0, 10);

  return (
    <GameShell
      title="Highscore"
      onClose={handleClose}
      badge={<Badge variant="accent">{Math.min(dartsThrown + dartsThisVisit, dartsTarget)}/{dartsTarget} lotek</Badge>}
    >
      <div className="flex shrink-0 flex-col items-center gap-1 pb-3 pt-6">
        <span className="text-xs font-medium uppercase tracking-widest text-content-secondary">wynik</span>
        <span className="font-display text-9xl font-extrabold leading-none tabular-nums text-content-primary">
          {score}
        </span>
        {personalBest !== null && (
          <span className={cn('text-sm font-medium', isNewBest ? 'text-score-up-text' : 'text-content-secondary')}>
            {isNewBest ? 'nowy rekord!' : `rekord: ${personalBest}`}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        <div className="flex flex-col gap-1">
          {recentVisits.map((v, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center justify-between rounded-lg px-3 py-2',
                i === 0 ? 'bg-surface-muted' : 'bg-surface-overlay',
              )}
            >
              <span className="text-xs text-content-secondary">{v.darts} {v.darts === 1 ? 'lotka' : 'lotki'}</span>
              <span className="font-display text-sm font-bold tabular-nums text-content-primary">{v.score}</span>
            </div>
          ))}
        </div>
      </div>

      {input !== '' && (
        <div className="flex shrink-0 items-baseline justify-center gap-3 border-t border-border-subtle px-4 py-2.5">
          <span className={cn(
            'font-display text-4xl font-extrabold tabular-nums leading-none',
            isOverMax ? 'text-score-down-text' : 'text-content-primary',
          )}>
            {inputNum}
          </span>
          {isOverMax && (
            <span className="text-sm leading-none text-score-down-text">max {maxThisVisit}</span>
          )}
        </div>
      )}

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

      {phase === 'game-over' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-surface-base px-8">
          <div className="text-center">
            <p className={cn(
              'text-xs font-medium uppercase tracking-widest',
              isNewBest ? 'text-score-up-text' : 'text-content-secondary',
            )}>
              {isNewBest ? 'Nowy rekord!' : 'Sesja ukończona'}
            </p>
            <p className="mt-2 font-display text-5xl font-extrabold tabular-nums text-content-primary">{score}</p>
            <p className="mt-1 text-sm text-content-secondary">punktów z {dartsTarget} lotek</p>
          </div>

          <div className="flex w-full max-w-xs gap-3">
            <Button variant="secondary" fullWidth onClick={handleClose}>Zamknij</Button>
          </div>
        </div>
      )}
    </GameShell>
  );
}
