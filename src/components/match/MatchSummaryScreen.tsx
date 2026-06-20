import { useMemo, useState } from 'react';
import type { LegRecord, MatchSlot } from '../../types/bracket';
import { computeMatchStats, type PlayerMatchStats } from '../../utils/statistics';
import { Button } from '../ui/Button';
import { OptionButton } from '../ui/OptionButton';
import { cn } from '../ui/cn';

type Props = {
  matchId:       string;
  playerTop:     MatchSlot;
  playerBottom:  MatchSlot;
  completedLegs: LegRecord[];
  legsWon:       [number, number];
  setsWon:       [number, number];
  isMultiSet:    boolean;
  onClose:       () => void;
  onSave?:       () => void;
};

const BUCKETS = [
  { label: '0–39',    min: 0,   max: 40  },
  { label: '40–79',   min: 40,  max: 80  },
  { label: '80–119',  min: 80,  max: 120 },
  { label: '120–159', min: 120, max: 160 },
  { label: '160–179', min: 160, max: 180 },
  { label: '180',     min: 180, max: 181 },
];

function getVisits(legs: LegRecord[], player: 0 | 1): number[] {
  return legs.flatMap(leg =>
    leg.rounds
      .map(r => (player === 0 ? r.p0?.score : r.p1?.score))
      .filter((s): s is number => s !== undefined)
  );
}

export function MatchSummaryScreen({
  matchId, playerTop, playerBottom, completedLegs,
  legsWon, setsWon, isMultiSet, onClose, onSave,
}: Props) {
  const topName    = playerTop.playerName    ?? 'Gracz 1';
  const bottomName = playerBottom.playerName ?? 'Gracz 2';

  const [statsTop, statsBottom] = useMemo(
    () => computeMatchStats(
      matchId, completedLegs,
      [topName, bottomName],
      [playerTop.playerId, playerBottom.playerId],
    ),
    [matchId, completedLegs, topName, bottomName, playerTop.playerId, playerBottom.playerId],
  );

  const topVisits    = useMemo(() => getVisits(completedLegs, 0), [completedLegs]);
  const bottomVisits = useMemo(() => getVisits(completedLegs, 1), [completedLegs]);
  const topMax       = topVisits.length    > 0 ? Math.max(...topVisits)    : 0;
  const bottomMax    = bottomVisits.length > 0 ? Math.max(...bottomVisits) : 0;

  const topScore    = isMultiSet ? setsWon[0]  : legsWon[0];
  const bottomScore = isMultiSet ? setsWon[1]  : legsWon[1];
  const topWon      = topScore > bottomScore;
  const winnerName  = topWon ? topName : bottomName;

  const topCounts    = BUCKETS.map(b => topVisits.filter(v => v >= b.min && v < b.max).length);
  const bottomCounts = BUCKETS.map(b => bottomVisits.filter(v => v >= b.min && v < b.max).length);
  const maxCount     = Math.max(...topCounts, ...bottomCounts, 1);

  const [selectedLegIdx, setSelectedLegIdx] = useState(0);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-surface-base select-none">

      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-widest text-content-secondary">
          Podsumowanie
        </span>
        <Button variant="secondary" size="sm" onClick={onClose}>Zamknij</Button>
      </div>

      {/* Winner */}
      <div className="flex shrink-0 flex-col items-center border-b border-border-subtle px-4 py-8">
        <span className="text-xs font-medium uppercase tracking-widest text-content-secondary">
          Zwycięzca
        </span>
        <span className="mt-2 text-center font-display text-4xl font-extrabold leading-tight text-content-primary">
          {winnerName}
        </span>
        <span className="mt-3 font-display text-2xl font-bold tabular-nums text-content-accent">
          {topScore} – {bottomScore}
        </span>
        <span className="mt-0.5 text-xs text-content-secondary">
          {isMultiSet ? 'sety' : 'legi'}
        </span>
      </div>

      {/* Per-player stats */}
      <div className="mx-4 mt-4 grid grid-cols-2 overflow-hidden rounded-xl border border-border-subtle">
        <PlayerStatCard
          name={topName}
          stats={statsTop}
          maxVisit={topMax}
          isWinner={topWon}
        />
        <PlayerStatCard
          name={bottomName}
          stats={statsBottom}
          maxVisit={bottomMax}
          isWinner={!topWon}
          className="border-l border-border-subtle"
        />
      </div>

      {/* Score distribution */}
      <div className="mx-4 mt-4 rounded-xl border border-border-subtle p-4">
        <p className="mb-4 text-xs font-medium uppercase tracking-widest text-content-secondary">
          Rozkład wyników wizyt
        </p>
        <ScoreHistogram
          topCounts={topCounts}
          bottomCounts={bottomCounts}
          maxCount={maxCount}
          topName={topName}
          bottomName={bottomName}
        />
      </div>

      {/* Leg scorecards */}
      {completedLegs.length > 0 && (
        <div className="mx-4 mb-2 mt-4 rounded-xl border border-border-subtle p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-content-secondary">
            Tablica legów
          </p>
          {completedLegs.length > 1 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {completedLegs.map((_, i) => (
                <OptionButton
                  key={i}
                  selected={selectedLegIdx === i}
                  onClick={() => setSelectedLegIdx(i)}
                >
                  Leg {i + 1}
                </OptionButton>
              ))}
            </div>
          )}
          <LegScorecard
            leg={completedLegs[selectedLegIdx]}
            topName={topName}
            bottomName={bottomName}
          />
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto flex shrink-0 gap-3 px-4 pb-8 pt-4">
        <Button variant="secondary" size="lg" fullWidth onClick={onClose}>Zamknij</Button>
        {onSave && (
          <Button variant="primary" size="lg" fullWidth onClick={onSave}>Zapisz wynik</Button>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PlayerStatCard({
  name, stats, maxVisit, isWinner, className,
}: {
  name: string;
  stats: PlayerMatchStats;
  maxVisit: number;
  isWinner: boolean;
  className?: string;
}) {
  const doublePct = stats.double_attempts > 0
    ? Math.round(stats.double_hits / stats.double_attempts * 100) + '%'
    : '—';

  return (
    <div className={cn('flex flex-col p-4', isWinner && 'bg-accent-soft', className)}>
      {/* Reserve space for winner label in both cards to keep rows aligned */}
      <span className={cn(
        'mb-1 text-xs font-bold uppercase tracking-widest text-content-accent',
        !isWinner && 'invisible',
      )}>
        Wygrał
      </span>
      <span className="truncate text-sm font-semibold text-content-primary">{name}</span>

      <div className="mt-3">
        <span className="font-display text-3xl font-extrabold tabular-nums leading-none text-content-accent">
          {stats.match_average > 0 ? stats.match_average.toFixed(1) : '—'}
        </span>
        <span className="mt-0.5 block text-xs text-content-secondary">śred. wizyty</span>
      </div>

      <div className="mt-3 space-y-1.5">
        <StatRow label="180"  value={stats.count_180} />
        <StatRow label="100+" value={stats.high_checkouts} />
        <StatRow label="≤15D" value={stats.short_legs} />
        <StatRow label="Max"  value={maxVisit} />
        <StatRow label="% D"  value={doublePct} />
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-content-secondary">{label}</span>
      <span className="text-sm font-bold tabular-nums text-content-primary">{value}</span>
    </div>
  );
}

function LegScorecard({
  leg, topName, bottomName,
}: {
  leg: LegRecord;
  topName: string;
  bottomName: string;
}) {
  const wonTop = leg.winner === 'top';
  return (
    <div>
      {/* Column headers — 1fr / 2rem / 1fr expressed on-scale via flex */}
      <div className="mb-2 flex items-baseline gap-1 border-b border-border-subtle pb-2">
        <span className={cn(
          'flex-1 truncate text-xs font-semibold',
          wonTop ? 'text-content-accent' : 'text-content-secondary',
        )}>
          {topName}
        </span>
        <span className="w-8 shrink-0 text-center text-xs text-content-faint">D</span>
        <span className={cn(
          'flex-1 truncate text-right text-xs font-semibold',
          !wonTop ? 'text-content-accent' : 'text-content-secondary',
        )}>
          {bottomName}
        </span>
      </div>

      {/* Rounds */}
      {leg.rounds.map((r, i) => {
        const darts = (i + 1) * 3;
        return (
          <div
            key={i}
            className="flex items-baseline gap-1 border-b border-border-subtle py-1.5 last:border-0"
          >
            {/* p0: score · remaining */}
            <div className="flex flex-1 items-baseline gap-1.5">
              {r.p0 ? (
                <>
                  <span className="font-display text-sm font-bold tabular-nums text-content-primary">
                    {r.p0.score}
                  </span>
                  <span className="text-xs tabular-nums text-content-faint">
                    {r.p0.remaining}
                  </span>
                </>
              ) : null}
            </div>

            {/* Dart count */}
            <span className="w-8 shrink-0 self-center text-center text-xs tabular-nums text-content-faint">
              {darts}
            </span>

            {/* p1: remaining · score */}
            <div className="flex flex-1 items-baseline justify-end gap-1.5">
              {r.p1 ? (
                <>
                  <span className="text-xs tabular-nums text-content-faint">
                    {r.p1.remaining}
                  </span>
                  <span className="font-display text-sm font-bold tabular-nums text-content-primary">
                    {r.p1.score}
                  </span>
                </>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ScoreHistogram({
  topCounts, bottomCounts, maxCount, topName, bottomName,
}: {
  topCounts: number[];
  bottomCounts: number[];
  maxCount: number;
  topName: string;
  bottomName: string;
}) {
  const W = 360, H = 120;
  const PAD_H = 12;
  const CHART_TOP = 8;
  const CHART_BOT = 88;
  const CHART_H = CHART_BOT - CHART_TOP;
  const CHART_W = W - 2 * PAD_H;
  const n = BUCKETS.length;
  const bucketW = CHART_W / n;
  const barW = Math.floor(bucketW * 0.32);
  const gap = Math.max(2, Math.floor(bucketW * 0.05));
  const sideGap = (bucketW - 2 * barW - gap) / 2;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden="true">
        <line
          x1={PAD_H} y1={CHART_BOT}
          x2={W - PAD_H} y2={CHART_BOT}
          stroke="var(--color-border-subtle)" strokeWidth="1"
        />
        {BUCKETS.map((b, i) => {
          const bx = PAD_H + i * bucketW;
          const topH = (topCounts[i]    / maxCount) * CHART_H;
          const botH = (bottomCounts[i] / maxCount) * CHART_H;
          const topX = bx + sideGap;
          const botX = topX + barW + gap;

          return (
            <g key={b.label}>
              <rect
                x={topX} y={CHART_BOT - (topH || 1.5)}
                width={barW} height={topH || 1.5}
                fill={topCounts[i] > 0 ? 'var(--color-content-accent)' : 'var(--color-border-subtle)'} rx="2"
              />
              {topCounts[i] > 0 && (
                <text
                  x={topX + barW / 2} y={CHART_BOT - topH - 3}
                  textAnchor="middle" fontSize="8" fill="var(--color-accent-text)"
                >
                  {topCounts[i]}
                </text>
              )}

              <rect
                x={botX} y={CHART_BOT - (botH || 1.5)}
                width={barW} height={botH || 1.5}
                fill={bottomCounts[i] > 0 ? 'var(--color-content-secondary)' : 'var(--color-border-subtle)'} rx="2"
              />
              {bottomCounts[i] > 0 && (
                <text
                  x={botX + barW / 2} y={CHART_BOT - botH - 3}
                  textAnchor="middle" fontSize="8" fill="var(--color-content-secondary)"
                >
                  {bottomCounts[i]}
                </text>
              )}

              <text
                x={bx + bucketW / 2} y={H - 6}
                textAnchor="middle" fontSize="9" fill="var(--color-content-faint)"
              >
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex items-center justify-center gap-6 text-xs text-content-secondary">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-5 rounded-sm bg-content-accent" />
          <span className="max-w-32 truncate">{topName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-5 rounded-sm bg-content-secondary" />
          <span className="max-w-32 truncate">{bottomName}</span>
        </div>
      </div>
    </div>
  );
}
