import { useMemo } from 'react';
import type { LegRecord, MatchSlot } from '../../types/bracket';
import { computeMatchStats, type PlayerMatchStats } from '../../utils/statistics';

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

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-brand-black overflow-y-auto select-none">

      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-widest text-content-secondary">
          Podsumowanie
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium text-content-secondary hover:text-brand-white transition-colors"
        >
          Zamknij
        </button>
      </div>

      {/* Winner */}
      <div className="shrink-0 flex flex-col items-center py-8 px-4 border-b border-border-subtle">
        <span className="text-xs font-medium uppercase tracking-widest text-content-secondary">
          Zwycięzca
        </span>
        <span className="mt-2 text-4xl font-black text-brand-white text-center leading-tight">
          {winnerName}
        </span>
        <span className="mt-3 text-2xl font-bold tabular-nums text-brand-purple">
          {topScore} – {bottomScore}
        </span>
        <span className="mt-0.5 text-xs text-content-secondary">
          {isMultiSet ? 'sety' : 'legi'}
        </span>
      </div>

      {/* Per-player stats */}
      <div className="grid grid-cols-2 mx-4 mt-4 overflow-hidden rounded-xl border border-border-subtle">
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
      <div className="mx-4 mt-4 mb-2 rounded-xl border border-border-subtle p-4">
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

      {/* Actions */}
      <div className="shrink-0 mt-auto px-4 pb-8 pt-4 flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl border border-border-subtle py-3 text-sm font-medium text-content-secondary hover:text-brand-white transition-colors"
        >
          Zamknij
        </button>
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            className="flex-1 rounded-xl bg-brand-purple/80 py-3 text-sm font-semibold text-brand-white hover:bg-brand-purple transition-colors"
          >
            Zapisz wynik
          </button>
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
  return (
    <div className={[
      'flex flex-col p-4 transition-colors',
      isWinner ? 'bg-brand-purple/5' : '',
      className ?? '',
    ].join(' ')}>
      {isWinner && (
        <span className="mb-1 text-[10px] font-bold uppercase tracking-widest text-brand-purple">
          Wygrał
        </span>
      )}
      <span className="text-sm font-semibold text-brand-white truncate">{name}</span>

      <div className="mt-3">
        <span className="text-3xl font-black tabular-nums leading-none text-brand-purple">
          {stats.match_average > 0 ? stats.match_average.toFixed(1) : '—'}
        </span>
        <span className="mt-0.5 block text-[10px] text-content-secondary">śred. wizyty</span>
      </div>

      <div className="mt-3 space-y-1.5">
        <StatRow label="180"  value={stats.count_180} />
        <StatRow label="100+" value={stats.high_checkouts} />
        <StatRow label="≤15D" value={stats.short_legs} />
        <StatRow label="Max"  value={maxVisit} />
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-content-secondary">{label}</span>
      <span className="text-sm font-bold tabular-nums text-brand-white">{value}</span>
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
          stroke="#27272a" strokeWidth="1"
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
                fill={topCounts[i] > 0 ? '#7c3aed' : '#27272a'} rx="2"
              />
              {topCounts[i] > 0 && (
                <text
                  x={topX + barW / 2} y={CHART_BOT - topH - 3}
                  textAnchor="middle" fontSize="8" fill="#a78bfa"
                >
                  {topCounts[i]}
                </text>
              )}

              <rect
                x={botX} y={CHART_BOT - (botH || 1.5)}
                width={barW} height={botH || 1.5}
                fill={bottomCounts[i] > 0 ? '#4b5563' : '#27272a'} rx="2"
              />
              {bottomCounts[i] > 0 && (
                <text
                  x={botX + barW / 2} y={CHART_BOT - botH - 3}
                  textAnchor="middle" fontSize="8" fill="#9ca3af"
                >
                  {bottomCounts[i]}
                </text>
              )}

              <text
                x={bx + bucketW / 2} y={H - 6}
                textAnchor="middle" fontSize="9" fill="#52525b"
              >
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex items-center justify-center gap-6 text-xs text-content-secondary">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-5 rounded-sm bg-brand-purple" />
          <span className="truncate max-w-[120px]">{topName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-5 rounded-sm bg-[#4b5563]" />
          <span className="truncate max-w-[120px]">{bottomName}</span>
        </div>
      </div>
    </div>
  );
}
