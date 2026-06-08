import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TrainingSession } from '../../types/player';

type Range = '7d' | '30d' | '365d' | 'all';

const RANGES: { key: Range; label: string }[] = [
  { key: '7d',   label: '7 dni'  },
  { key: '30d',  label: '30 dni' },
  { key: '365d', label: 'Rok'    },
  { key: 'all',  label: 'Cały czas' },
];

const PURPLE       = '#ac58e9';
const EMERALD      = '#34d399';
const GRID_COLOR   = 'rgba(255,255,255,0.06)';
const AXIS_COLOR   = '#a3a3a3';
const TOOLTIP_BG   = '#111111';
const TOOLTIP_BORDER = 'rgba(172,88,233,0.3)';

interface Props {
  sessions: TrainingSession[];
}

export function TrainingCharts({ sessions }: Props) {
  const [range, setRange] = useState<Range>('30d');

  const filtered = filterByRange(sessions, range);
  const avgData  = filtered.map(s => ({
    date:    formatDate(s.played_at),
    average: round2(s.average),
  }));
  const doubleData = filtered
    .filter(s => s.double_attempts > 0)
    .map(s => ({
      date: formatDate(s.played_at),
      pct:  round1((s.double_hits / s.double_attempts) * 100),
    }));

  return (
    <div className="flex flex-col gap-6">
      {/* Range selector */}
      <div className="flex gap-1.5">
        {RANGES.map(r => (
          <button
            key={r.key}
            type="button"
            onClick={() => setRange(r.key)}
            className={[
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              range === r.key
                ? 'bg-brand-purple/20 text-brand-white'
                : 'text-content-secondary hover:text-brand-white',
            ].join(' ')}
          >
            {r.label}
          </button>
        ))}
      </div>

      {filtered.length < 2 ? (
        <div className="rounded-xl border border-border-subtle bg-white/3 px-6 py-8 text-center">
          <p className="text-sm text-content-secondary">
            Za mało danych dla wybranego okresu.
          </p>
        </div>
      ) : (
        <>
          {/* Average chart */}
          <ChartCard title="Średnia">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={avgData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                  width={36}
                />
                <Tooltip content={<CustomTooltip unit="" />} />
                <Line
                  type="monotone"
                  dataKey="average"
                  stroke={PURPLE}
                  strokeWidth={2}
                  dot={{ fill: PURPLE, r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: PURPLE, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Double accuracy chart */}
          {doubleData.length >= 2 ? (
            <ChartCard title="% kończenia na doublach">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={doubleData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                    width={36}
                    tickFormatter={v => `${v}%`}
                  />
                  <Tooltip content={<CustomTooltip unit="%" />} />
                  <Line
                    type="monotone"
                    dataKey="pct"
                    stroke={EMERALD}
                    strokeWidth={2}
                    dot={{ fill: EMERALD, r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: EMERALD, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          ) : (
            <ChartCard title="% kończenia na doublach">
              <div className="flex h-[180px] items-center justify-center">
                <p className="text-xs text-content-secondary">
                  Brak danych o doublach dla wybranego okresu.
                </p>
              </div>
            </ChartCard>
          )}
        </>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-white/3 p-4">
      <p className="mb-3 text-xs font-medium text-content-secondary">{title}</p>
      {children}
    </div>
  );
}

function CustomTooltip({ active, payload, label, unit }: {
  active?: boolean;
  payload?: { value: number }[];
  label?:   string;
  unit:     string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{ background: TOOLTIP_BG, border: `1px solid ${TOOLTIP_BORDER}` }}
      className="rounded-lg px-3 py-2 text-xs shadow-xl"
    >
      <p className="text-content-secondary mb-0.5">{label}</p>
      <p className="font-bold text-brand-white">{payload[0].value}{unit}</p>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function filterByRange(sessions: TrainingSession[], range: Range): TrainingSession[] {
  if (range === 'all') return [...sessions].reverse();
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 365;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return [...sessions].reverse().filter(s => s.played_at >= cutoffStr);
}

function formatDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}.${m}`;
}

function round2(n: number) { return Math.round(n * 100) / 100; }
function round1(n: number) { return Math.round(n * 10) / 10; }
