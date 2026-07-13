import { lazy, Suspense, useState } from 'react';
import legendIcon from '../assets/icons/5-legenda.svg';
import { useAuth } from '../context/AuthContext';
import { useMyStats, useMyEvents } from '../hooks/usePlayers';
import { useTrainingSessions } from '../hooks/useTraining';
import type { PlayerEvent, PlayerStats, TrainingSession } from '../types/player';
import { fmtDate, fmtDateShort } from '../utils/formatting';
import { Card } from '../components/ui/Card';
import { Stat } from '../components/ui/Stat';
import { Badge } from '../components/ui/Badge';
import { SegmentedControl } from '../components/ui/SegmentedControl';

const TrainingChart = lazy(() =>
  import('../components/profile/TrainingCharts').then(m => ({ default: m.TrainingChart }))
);

// ── Placeholder data ──────────────────────────────────────────────────────────

// Placeholder — ostatnie miejsca w turniejach (1 = zwycięstwo, 2 = finalista, itd.)
const RECENT_PLACEMENTS = [1, 5, 2, 3, 1, 8];

function placementLabel(rank: number): string {
  if (rank === 1)  return '1.';
  if (rank === 2)  return '2.';
  if (rank <= 4)   return '3-4.';
  if (rank <= 8)   return '5-8.';
  if (rank <= 16)  return '9-16.';
  if (rank <= 32)  return '17-32.';
  return '33+.';
}

function placementVariant(rank: number): 'rank' | 'up' | 'neutral' {
  if (rank === 1) return 'rank';
  if (rank <= 4)  return 'up';
  return 'neutral';
}

const MONTHS_PL = ['STY','LUT','MAR','KWI','MAJ','CZE','LIP','SIE','WRZ','PAŹ','LIS','GRU'];

function parseDateParts(iso: string) {
  const [, m, d] = iso.split('-');
  return { day: d, month: MONTHS_PL[parseInt(m, 10) - 1] };
}

type Metric = 'average' | 'double_pct';
type Range  = '7d' | '30d' | '365d' | 'all';

const RANGES: { value: Range; label: string }[] = [
  { value: '7d',   label: '7 dni'     },
  { value: '30d',  label: '30 dni'    },
  { value: '365d', label: 'Rok'       },
  { value: 'all',  label: 'Cały czas' },
];

const METRICS: { value: Metric; label: string }[] = [
  { value: 'average',    label: 'Średnia'       },
  { value: 'double_pct', label: '% na doublach' },
];

// Chart colours reference design tokens (SVG stroke accepts CSS variables).
const CHART_COLOR: Record<Metric, string> = {
  average:    'var(--color-content-accent)',
  double_pct: 'var(--color-score-up)',
};

// ── Main page ─────────────────────────────────────────────────────────────────

export function ProfilePage() {
  const { username }                                         = useAuth();
  const { data, isLoading, isError }                         = useMyStats();
  const { data: sessions = [], isLoading: sessionsLoading }  = useTrainingSessions();
  const { data: events   = [] }                              = useMyEvents();

  if (isLoading || sessionsLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-content-secondary">Ładowanie...</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-content-secondary">Nie udało się załadować profilu.</span>
      </div>
    );
  }

  const { player, stats } = data;
  const bestSession = sessions.length > 0
    ? sessions.reduce((b, s) => s.average > b.average ? s : b)
    : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
      <div className="flex flex-col gap-5 lg:flex-row">

        {/* ── Sidebar ────────────────────────────────────────── */}
        <aside className="flex flex-col gap-4 lg:w-64 lg:shrink-0">
          <Card>
            {/* Avatar + name */}
            <div className="mb-5 flex flex-col items-center text-center">
              <div className="relative mb-3">
                <img src={legendIcon} alt="" className="h-24 w-24 select-none" />
              </div>
              <h1 className="text-lg font-bold text-content-primary">
                {player.first_name} {player.last_name}
              </h1>
              <p className="text-xs text-content-secondary">@{username}</p>
              <Badge variant="accent" className="mt-2">#12 w rankingu</Badge>
            </div>

            {/* Tags */}
            <div className="mb-5 flex flex-wrap justify-center gap-1.5">
              <Badge variant="neutral">Liga okręgowa</Badge>
              <Badge variant="neutral">Kraków, PL</Badge>
            </div>

            {/* Miejsca turniejowe */}
            <div className="mb-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-content-secondary">
                Forma · ostatnie {RECENT_PLACEMENTS.length}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {RECENT_PLACEMENTS.map((rank, i) => (
                  <Badge key={i} variant={placementVariant(rank)} mono>
                    {placementLabel(rank)}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Quick stats */}
            <div className="flex flex-col gap-2.5 border-t border-border-subtle pt-4">
              <SidebarStat label="Mecze"            value={String(stats.matches_played)} />
              <SidebarStat label="Najlepsza średnia" value={bestSession ? bestSession.average.toFixed(2) : '—'} />
              <SidebarStat label="180 łącznie"       value={String(stats.count_180)} />
              <SidebarStat label="Highfinishe"       value={String(stats.high_checkouts)} />
            </div>
          </Card>
        </aside>

        {/* ── Main content ───────────────────────────────────── */}
        <div className="flex flex-col gap-5 lg:min-w-0 lg:flex-1">
          <ProgressSection sessions={sessions} />
          <TournamentStatsSection stats={stats} />
          <TrainingSummarySection sessions={sessions} />
          <EventsSection events={events} />
        </div>
      </div>
    </div>
  );
}

// ── Progress chart section ────────────────────────────────────────────────────

function ProgressSection({ sessions }: { sessions: TrainingSession[] }) {
  const [metric, setMetric] = useState<Metric>('average');
  const [range,  setRange]  = useState<Range>('30d');

  const filtered = filterByRange(sessions, range);

  const chartData = filtered.flatMap(s => {
    if (metric === 'average') return [{ date: fmtDateShort(s.played_at), value: round2(s.average) }];
    if (s.double_attempts > 0) return [{ date: fmtDateShort(s.played_at), value: round1(s.double_hits / s.double_attempts * 100) }];
    return [];
  });

  const last  = chartData[chartData.length - 1]?.value ?? null;
  const prev  = chartData[chartData.length - 2]?.value ?? null;
  const delta = last !== null && prev !== null ? last - prev : null;
  const deltaPct = delta !== null && prev ? (delta / prev) * 100 : null;

  const unit    = metric === 'double_pct' ? '%' : '';
  const yDomain = metric === 'double_pct' ? ([0, 100] as [number, number]) : undefined;

  const deltaText = delta !== null && deltaPct !== null
    ? `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}${unit} (${delta >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%)`
    : undefined;

  return (
    <Card>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        {last !== null ? (
          <Stat
            size="lg"
            label="Postęp w czasie"
            value={last}
            unit={unit}
            delta={delta ?? undefined}
            deltaText={deltaText}
          />
        ) : (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-content-secondary">
              Postęp w czasie
            </p>
            <p className="mt-2 text-sm text-content-secondary">Brak danych</p>
          </div>
        )}

        <SegmentedControl aria-label="Metryka" value={metric} onChange={setMetric} options={METRICS} />
      </div>

      {/* Chart */}
      <Suspense fallback={<div className="h-48 rounded-lg bg-surface-muted animate-pulse" />}>
        {chartData.length >= 2 ? (
          <TrainingChart data={chartData} color={CHART_COLOR[metric]} unit={unit} yDomain={yDomain} />
        ) : (
          <div className="flex h-48 items-center justify-center">
            <p className="text-xs text-content-secondary">Za mało danych dla wybranego okresu.</p>
          </div>
        )}
      </Suspense>

      {/* Range selector */}
      <div className="mt-3">
        <SegmentedControl aria-label="Zakres czasu" value={range} onChange={setRange} options={RANGES} />
      </div>
    </Card>
  );
}

// ── Tournament stats section ──────────────────────────────────────────────────

function TournamentStatsSection({ stats }: { stats: PlayerStats['stats'] }) {
  return (
    <Card>
      <SectionHeader label="Statystyki turniejowe" sub={`${stats.matches_played} meczów`} />

      {stats.matches_played === 0 ? (
        <p className="text-sm text-content-secondary">Brak rozegranych meczów turniejowych.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Big cards row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card variant="inset">
              <Stat
                size="md"
                label="Średnia"
                value={stats.match_average > 0 ? stats.match_average.toFixed(2) : '—'}
                caption="ze wszystkich turniejów"
              />
            </Card>
            <Card variant="inset">
              <Stat
                size="md"
                label="% na doublach"
                value={stats.double_accuracy !== null ? stats.double_accuracy : '—'}
                unit={stats.double_accuracy !== null ? '%' : undefined}
                caption="ze wszystkich turniejów"
              />
            </Card>
          </div>
          {/* Small cards row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card variant="inset" padding="sm">
              <Stat size="sm" label="Mecze" value={String(stats.matches_played)} />
            </Card>
            <Card variant="inset" padding="sm">
              <Stat size="sm" label="Lotki / leg" value={stats.darts_per_leg > 0 ? stats.darts_per_leg.toFixed(1) : '—'} />
            </Card>
            <Card variant="inset" padding="sm">
              <Stat size="sm" label="180" value={String(stats.count_180)} />
            </Card>
            <Card variant="inset" padding="sm">
              <Stat size="sm" label="Highfinishe" value={String(stats.high_checkouts)} />
            </Card>
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Training summary section ──────────────────────────────────────────────────

function TrainingSummarySection({ sessions }: { sessions: TrainingSession[] }) {
  const bestIdx = sessions.length > 0
    ? sessions.reduce((bi, s, i) => s.average > sessions[bi].average ? i : bi, 0)
    : -1;
  const best     = bestIdx >= 0 ? sessions[bestIdx] : null;
  const isNewest = bestIdx === 0; // sessions are ordered newest first
  const totalLegs = sessions.reduce((s, r) => s + r.legs, 0);
  const weightedAvg = totalLegs > 0
    ? sessions.reduce((s, r) => s + r.average * r.legs, 0) / totalLegs
    : null;

  const streakCount = (() => {
    let s = 0;
    for (const sess of sessions) {
      const prev = sessions[sessions.indexOf(sess) + 1];
      if (prev && sess.average > prev.average) s++;
      else break;
    }
    return s;
  })();

  const avgDelta = sessions.length >= 2
    ? round2(sessions[0].average - sessions[1].average)
    : null;

  return (
    <Card>
      <SectionHeader label="Treningi solo" sub={`${sessions.length} sesji`} />

      {sessions.length === 0 ? (
        <p className="text-sm text-content-secondary">Zagraj mecz w trybie Solo, aby zobaczyć statystyki.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card variant="inset">
            <Stat
              size="md"
              label="Najlepsza"
              value={best ? best.average.toFixed(2) : '—'}
              badge={isNewest ? <Badge variant="up">Rekord</Badge> : undefined}
              caption={best ? fmtDate(best.played_at) : undefined}
            />
          </Card>

          <Card variant="inset">
            <Stat
              size="md"
              label="Seria wzrostów"
              value={streakCount}
              caption={streakCount > 0 ? 'sesje z rzędu w górę' : 'ostatnia sesja nie wzrosła'}
            />
          </Card>

          <Card variant="inset">
            <Stat
              size="md"
              label="Śr. ważona"
              value={weightedAvg !== null ? weightedAvg.toFixed(2) : '—'}
              delta={avgDelta ?? undefined}
              deltaText={avgDelta !== null ? `${avgDelta >= 0 ? '+' : ''}${avgDelta} za poprz. sesję` : undefined}
            />
          </Card>
        </div>
      )}
    </Card>
  );
}

// ── Events section ────────────────────────────────────────────────────────────

function EventsSection({ events }: { events: PlayerEvent[] }) {
  return (
    <Card>
      <SectionHeader
        label="Nadchodzące wydarzenia"
        sub={events.length > 0 ? `${events.length} następnych` : 'brak'}
      />

      {events.length === 0 ? (
        <p className="text-sm text-content-secondary">Brak nadchodzących wydarzeń.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {events.map((e, i) => {
            const { day, month } = parseDateParts(e.date);
            const isLeague = e.type === 'league_match';
            return (
              <div key={i} className="flex items-center gap-4 rounded-xl border border-border-subtle p-3">
                {/* Date box */}
                <div className="flex w-11 shrink-0 flex-col items-center rounded-lg border border-border-subtle bg-surface-muted px-1 py-1.5 text-center">
                  <span className="font-display text-lg font-extrabold leading-none text-content-primary">{day}</span>
                  <span className="text-xs font-semibold uppercase text-content-secondary">{month}</span>
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5">
                    <Badge variant={isLeague ? 'accent' : 'neutral'}>
                      {isLeague ? 'MECZ LIGOWY' : 'TURNIEJ'}
                    </Badge>
                  </div>
                  <p className="truncate text-sm font-semibold text-content-primary">{e.title}</p>
                  {e.subtitle && (
                    <p className="truncate text-xs text-content-secondary">{e.subtitle}</p>
                  )}
                </div>

                {/* Matchday badge for league matches */}
                {isLeague && e.matchday != null && (
                  <span className="shrink-0 text-xs text-content-faint">kol. {e.matchday}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ── Small shared components (local to this page) ────────────────────────────────

function SectionHeader({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between">
      <p className="text-xs font-semibold uppercase tracking-widest text-content-secondary">{label}</p>
      <p className="text-xs text-content-secondary">{sub}</p>
    </div>
  );
}

function SidebarStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-content-secondary">{label}</span>
      <span className="text-sm font-bold tabular-nums text-content-primary">{value}</span>
    </div>
  );
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function filterByRange(sessions: TrainingSession[], range: Range): TrainingSession[] {
  const sorted = [...sessions].reverse(); // oldest first
  if (range === 'all') return sorted;
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 365;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutStr = cutoff.toISOString().slice(0, 10);
  return sorted.filter(s => s.played_at >= cutStr);
}

function round2(n: number) { return Math.round(n * 100) / 100; }
function round1(n: number) { return Math.round(n * 10) / 10; }
