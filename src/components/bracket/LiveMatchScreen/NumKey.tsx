export type KeyVar = 'digit' | 'clear' | 'ok';

export function NumKey({
  label, variant, onPress, disabled = false,
}: {
  label: string; variant: KeyVar; onPress: () => void; disabled?: boolean;
}) {
  const base = 'flex items-center justify-center rounded-2xl text-2xl font-bold transition-colors active:scale-95';
  const styles: Record<KeyVar, string> = {
    digit: 'bg-white/5 text-brand-white hover:bg-white/10',
    clear: 'bg-red-950/70 text-red-400 hover:bg-red-900/70',
    ok:    'bg-brand-purple/80 text-brand-white hover:bg-brand-purple disabled:opacity-30',
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(e) => { e.preventDefault(); if (!disabled) onPress(); }}
      className={`${base} ${styles[variant]}`}
    >
      {label}
    </button>
  );
}
