interface Props {
  checked:  boolean;
  onChange: (v: boolean) => void;
}

export function Toggle({ checked, onChange }: Props) {
  return (
    <div
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={[
        'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 cursor-pointer',
        checked ? 'bg-brand-purple' : 'bg-white/10',
      ].join(' ')}
    >
      <span className={[
        'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200',
        checked ? 'translate-x-5' : 'translate-x-0.5',
      ].join(' ')} />
    </div>
  );
}
