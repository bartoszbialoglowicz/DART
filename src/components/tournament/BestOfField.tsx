import { Input } from '../ui/Input';

type Props = {
  /** Omit when the field is already wrapped in a `Field` that supplies its own label. */
  label?:   string;
  value:    string;
  min:      number;
  max:      number;
  onChange: (v: string) => void;
  onBlur:   () => void;
};

export function BestOfField({ label, value, min, max, onChange, onBlur }: Props) {
  const input = (
    <Input
      type="number"
      min={min}
      max={max}
      step={2}
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
      className="max-w-32"
    />
  );

  if (!label) return input;

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium uppercase tracking-widest text-content-secondary">{label}</p>
      {input}
    </div>
  );
}
