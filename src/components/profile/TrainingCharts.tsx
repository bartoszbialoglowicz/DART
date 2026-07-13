import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const GRID_COLOR     = 'var(--color-border-subtle)';
const AXIS_COLOR     = 'var(--color-content-secondary)';
const TOOLTIP_BG     = 'var(--color-surface-overlay)';
const TOOLTIP_BORDER = 'var(--color-border-subtle)';

interface Props {
  data:    { date: string; value: number }[];
  color:   string;
  unit:    string;
  yDomain?: [number | string, number | string];
}

export function TrainingChart({ data, color, unit, yDomain }: Props) {
  const gradId = `grad-${color.replace('#', '')}`;

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.18} />
            <stop offset="95%" stopColor={color} stopOpacity={0}    />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: AXIS_COLOR, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: AXIS_COLOR, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          domain={yDomain ?? ['auto', 'auto']}
          width={32}
          tickFormatter={v => `${v}${unit}`}
        />
        <Tooltip content={<ChartTooltip unit={unit} />} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradId})`}
          dot={{ fill: color, r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: color, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function ChartTooltip({ active, payload, label, unit }: {
  active?:   boolean;
  payload?:  { value: number }[];
  label?:    string;
  unit:      string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: TOOLTIP_BG, border: `1px solid ${TOOLTIP_BORDER}` }}
         className="rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-content-secondary mb-0.5">{label}</p>
      <p className="font-bold text-content-primary">{payload[0].value}{unit}</p>
    </div>
  );
}
