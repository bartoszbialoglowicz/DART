import { lazy, Suspense, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMyStats } from '../hooks/usePlayers';
import { useTrainingSessions } from '../hooks/useTraining';
import type { PlayerStats, TrainingSession } from '../types/player';
import { fmtDate, fmtDateShort } from '../utils/formatting';

const TrainingChart = lazy(() =>
  import('../components/profile/TrainingCharts').then(m => ({ default: m.TrainingChart }))
);

// ── Placeholder data ──────────────────────────────────────────────────────────

const FORM: ('W' | 'L')[] = ['W', 'W', 'L', 'W', 'W', 'L'];

const EVENTS = [
  { day: '12', month: 'CZE', type: 'mecz',     typeLabel: 'MECZ LIGOWY',         title: 'vs. Lotka Kraków',                  venue: 'Hala MOSiR, Kraków',  time: '19:00', soon: 'Za 3 dni' },
  { day: '21', month: 'CZE', type: 'turniej',   typeLabel: 'TURNIEJ',              title: 'Otwarte Mistrzostwa Małopolski',     venue: 'Tarnów',              time: '10:00', soon: null },
  { day: '28', month: 'CZE', type: 'mecz',     typeLabel: 'MECZ LIGOWY',         title: 'vs. Bull\'s Eye Tarnów',             venue: 'Dart Zone, Kraków',   time: '18:30', soon: null },
  { day: '05', month: 'LIP', type: 'ranking',   typeLabel: 'TURNIEJ RANKINGOWY',   title: 'PDC Amateur Series',                 venue: 'Warszawa',            time: '09:00', soon: null },
];

type Metric = 'average' | 'double_pct';
type Range  = '7d' | '30d' | '365d' | 'all';

const RANGES: { key: Range; label: string }[] = [
  { key: '7d',   label: '7 dni'     },
  { key: '30d',  label: '30 dni'    },
  { key: '365d', label: 'Rok'       },
  { key: 'all',  label: 'Cały czas' },
];

const METRICS: { key: Metric; label: string }[] = [
  { key: 'average',    label: 'Średnia'        },
  { key: 'double_pct', label: '% na doublach'  },
];

const PURPLE  = '#ac58e9';
const EMERALD = '#34d399';

// ── Main page ─────────────────────────────────────────────────────────────────

export function ProfilePage() {
  const { username }                          = useAuth();
  const { data, isLoading, isError }          = useMyStats();
  const { data: sessions = [], isLoading: sessionsLoading } = useTrainingSessions();

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
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">

        {/* ── Sidebar ────────────────────────────────────────── */}
        <aside className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border-subtle bg-white/3 p-5">

            {/* Avatar + name */}
            <div className="flex flex-col items-center text-center mb-5">
              <div className="relative mb-3">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-purple/25 text-3xl font-black text-brand-purple select-none">
                  {player.first_name[0]}{player.last_name[0]}
                </div>
                <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-brand-black bg-green-400" />
              </div>
              <h1 className="text-lg font-bold text-brand-white">
                {player.first_name} {player.last_name}
              </h1>
              <p className="text-xs text-content-secondary">@{username}</p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-brand-purple/30 bg-brand-purple/10 px-3 py-0.5 text-[11px] font-medium text-brand-purple">
                #12 w rankingu
              </span>
            </div>

            {/* Tags */}
            <div className="mb-5 flex flex-wrap justify-center gap-1.5 text-[11px] text-content-secondary">
              <span className="rounded-full border border-border-subtle px-2.5 py-0.5">Liga okręgowa</span>
              <span className="rounded-full border border-border-subtle px-2.5 py-0.5">Kraków, PL</span>
            </div>

            {/* Form */}
            <div className="mb-5">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-content-secondary">
                Forma · ostatni {FORM.length}
              </p>
              <div className="flex gap-1.5">
                {FORM.map((r, i) => (
                  <div
                    key={i}
                    className={[
                      'flex h-7 w-7 items-center justify-center rounded text-[11px] font-bold',
                      r === 'W'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/15 text-red-400',
                    ].join(' ')}
                  >
                    {r}
                  </div>
                ))}
              </div>
            </div>

            {/* Quick stats */}
            <div className="flex flex-col gap-2.5 border-t border-border-subtle pt-4">
              <SidebarStat label="Mecze"           value={String(stats.matches_played)} />
              <SidebarStat label="Najlepsza średnia" value={bestSession ? bestSession.average.toFixed(2) : '—'} />
              <SidebarStat label="180 łącznie"      value={String(stats.count_180)} />
              <SidebarStat label="Highfinishe"      value={String(stats.high_checkouts)} />
            </div>

            <button
              type="button"
              disabled
              className="mt-4 w-full rounded-lg border border-border-subtle py-2 text-xs font-medium text-content-secondary opacity-40 cursor-not-allowed"
            >
              Edytuj profil
            </button>
          </div>
        </aside>

        {/* ── Main content ───────────────────────────────────── */}
        <div className="flex flex-col gap-5">

          {/* Progress chart */}
          <ProgressSection sessions={sessions} />

          {/* Tournament stats */}
          <TournamentStatsSection stats={stats} />

          {/* Training summary */}
          <TrainingSummarySection sessions={sessions} />

          {/* Events */}
          <EventsSection />
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

  const color    = metric === 'average' ? PURPLE : EMERALD;
  const unit     = metric === 'double_pct' ? '%' : '';
  const yDomain  = metric === 'double_pct' ? ([0, 100] as [number, number]) : undefined;

  return (
    <div className="rounded-2xl border border-border-subtle bg-white/3 p-5">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-content-secondary">
            Postęp w czasie
          </p>
          {last !== null ? (
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-4xl font-black tabular-nums text-brand-white">
                {last}{unit}
              </span>
              {delta !== null && deltaPct !== null && (
                <span className={delta >= 0 ? 'text-sm font-semibold text-green-400' : 'text-sm font-semibold text-red-400'}>
                  {delta >= 0 ? '+' : ''}{delta.toFixed(2)}{unit}
                  {' '}({delta >= 0 ? '+' : ''}{deltaPct.toFixed(1)}%)
                </span>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-content-secondary">Brak danych</p>
          )}
        </div>

        {/* Metric tabs */}
        <div className="flex gap-1 rounded-lg border border-border-subtle p-1">
          {METRICS.map(m => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              className={[
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                metric === m.key
                  ? 'bg-brand-purple/20 text-brand-white'
                  : 'text-content-secondary hover:text-brand-white',
              ].join(' ')}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <Suspense fallback={<div className="h-[180px] rounded-lg bg-white/3 animate-pulse" />}>
        {chartData.length >= 2 ? (
          <TrainingChart data={chartData} color={color} unit={unit} yDomain={yDomain} />
        ) : (
          <div className="flex h-[180px] items-center justify-center">
            <p className="text-xs text-content-secondary">Za mało danych dla wybranego okresu.</p>
          </div>
        )}
      </Suspense>

      {/* Range selector */}
      <div className="mt-3 flex gap-1">
        {RANGES.map(r => (
          <button
            key={r.key}
            type="button"
            onClick={() => setRange(r.key)}
            className={[
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              range === r.key
                ? 'bg-white/10 text-brand-white'
                : 'text-content-secondary hover:text-brand-white',
            ].join(' ')}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Tournament stats section ──────────────────────────────────────────────────

function TournamentStatsSection({ stats }: { stats: PlayerStats['stats'] }) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-white/3 p-5">
      <SectionHeader label="Statystyki turniejowe" sub={`${stats.matches_played} meczów`} />

      {stats.matches_played === 0 ? (
        <p className="text-sm text-content-secondary">Brak rozegranych meczów turniejowych.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Big cards row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <BigStatCard
              label="Średnia"
              value={stats.match_average > 0 ? stats.match_average.toFixed(2) : '—'}
              sub="za poprzedni turniej"
            />
            <BigStatCard
              label="% na doublach"
              value={stats.double_accuracy !== null ? `${stats.double_accuracy}%` : '—'}
              sub="za poprzedni turniej"
            />
          </div>
          {/* Small cards row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SmallStatCard label="Mecze"      value={String(stats.matches_played)} />
            <SmallStatCard label="Lotki / leg" value={stats.darts_per_leg > 0 ? stats.darts_per_leg.toFixed(1) : '—'} />
            <SmallStatCard label="180"         value={String(stats.count_180)} />
            <SmallStatCard label="Highfinishe" value={String(stats.high_checkouts)} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Training summary section ──────────────────────────────────────────────────

function TrainingSummarySection({ sessions }: { sessions: TrainingSession[] }) {
  const bestIdx = sessions.length > 0
    ? sessions.reduce((bi, s, i) => s.average > sessions[bi].average ? i : bi, 0)
    : -1;
  const best      = bestIdx >= 0 ? sessions[bestIdx] : null;
  const isNewest  = bestIdx === 0; // sessions are ordered newest first
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
    <div className="rounded-2xl border border-border-subtle bg-white/3 p-5">
      <SectionHeader label="Treningi solo" sub={`${sessions.length} sesji`} />

      {sessions.length === 0 ? (
        <p className="text-sm text-content-secondary">Zagraj mecz w trybie Solo, aby zobaczyć statystyki.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Best */}
          <div className="rounded-xl border border-border-subtle bg-white/3 p-4">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs text-content-secondary">Najlepsza</p>
              {isNewest && (
                <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-bold text-green-400">
                  NOWE
                </span>
              )}
            </div>
            <p className="text-3xl font-black tabular-nums text-brand-white">
              {best ? best.average.toFixed(2) : '—'}
            </p>
            {best && (
              <p className="mt-1 text-[11px] text-content-secondary">{fmtDate(best.played_at)}</p>
            )}
          </div>

          {/* Streak */}
          <div className="rounded-xl border border-border-subtle bg-white/3 p-4">
            <p className="mb-1 text-xs text-content-secondary">Seria wzrostów</p>
            <p className="text-3xl font-black tabular-nums text-brand-white">{streakCount}</p>
            <p className="mt-1 text-[11px] text-content-secondary">
              {streakCount > 0 ? 'sesje z rzędu w górę' : 'ostatnia sesja nie wzrosła'}
            </p>
          </div>

          {/* Weighted avg + delta */}
          <div className="rounded-xl border border-border-subtle bg-white/3 p-4">
            <p className="mb-1 text-xs text-content-secondary">Śr. ważona</p>
            <p className="text-3xl font-black tabular-nums text-brand-white">
              {weightedAvg !== null ? weightedAvg.toFixed(2) : '—'}
            </p>
            {avgDelta !== null && (
              <p className={[
                'mt-1 text-[11px] font-semibold',
                avgDelta >= 0 ? 'text-green-400' : 'text-red-400',
              ].join(' ')}>
                {avgDelta >= 0 ? '+' : ''}{avgDelta} za poprz. sesję
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Events section ────────────────────────────────────────────────────────────

function EventsSection() {
  return (
    <div className="rounded-2xl border border-border-subtle bg-white/3 p-5">
      <SectionHeader label="Nadchodzące wydarzenia" sub={`${EVENTS.length} następnych`} />

      <div className="flex flex-col gap-2">
        {EVENTS.map((e, i) => (
          <div
            key={i}
            className="flex items-start gap-4 rounded-xl border border-border-subtle bg-white/3 px-4 py-3"
          >
            {/* Date box */}
            <div className="flex w-10 shrink-0 flex-col items-center rounded-lg bg-white/5 px-1 py-1.5 text-center">
              <span className="text-lg font-black leading-none text-brand-white">{e.day}</span>
              <span className="text-[10px] font-semibold uppercase text-content-secondary">{e.month}</span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <span className={[
                  'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                  e.type === 'mecz'    ? 'bg-blue-500/15 text-blue-400' :
                  e.type === 'ranking' ? 'bg-amber-500/15 text-amber-400' :
                                         'bg-brand-purple/15 text-brand-purple',
                ].join(' ')}>
                  {e.typeLabel}
                </span>
                {e.soon && (
                  <span className="text-[11px] font-medium text-green-400">{e.soon}</span>
                )}
              </div>
              <p className="text-sm font-semibold text-brand-white truncate">{e.title}</p>
              <p className="text-xs text-content-secondary truncate">{e.venue}</p>
            </div>

            {/* Time */}
            <span className="shrink-0 text-sm font-bold tabular-nums text-brand-white">{e.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Small shared components ───────────────────────────────────────────────────

function SectionHeader({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between">
      <p className="text-xs font-semibold uppercase tracking-widest text-content-secondary">{label}</p>
      <p className="text-[11px] text-content-secondary">{sub}</p>
    </div>
  );
}

function SidebarStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-content-secondary">{label}</span>
      <span className="text-sm font-bold tabular-nums text-brand-white">{value}</span>
    </div>
  );
}

function BigStatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-white/3 p-4">
      <p className="text-xs text-content-secondary">{label}</p>
      <p className="mt-1 text-4xl font-black tabular-nums text-brand-white">{value}</p>
      <p className="mt-1 text-[11px] text-content-secondary">{sub}</p>
    </div>
  );
}

function SmallStatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-white/3 p-3">
      <p className="text-xs text-content-secondary">{label}</p>
      <p className="mt-1 text-2xl font-black tabular-nums text-brand-white">{value}</p>
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
