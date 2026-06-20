import { GameKey } from '../../game/GameKey';

export type KeyVar = 'digit' | 'clear' | 'ok';

const TONE: Record<KeyVar, 'neutral' | 'danger' | 'accent'> = {
  digit: 'neutral',
  clear: 'danger',
  ok:    'accent',
};

/**
 * 501 numpad key. Thin wrapper over the shared <GameKey> so the keypad shares
 * one source of truth for tone + press feel with every other game. Uses the
 * children path (no built-in padding) — the numpad grid's `flex-1` rows set the
 * height.
 */
export function NumKey({
  label, variant, onPress, disabled = false,
}: {
  label: string; variant: KeyVar; onPress: () => void; disabled?: boolean;
}) {
  return (
    <GameKey
      tone={TONE[variant]}
      disabled={disabled}
      onPointerDown={(e) => { e.preventDefault(); if (!disabled) onPress(); }}
    >
      <span className="font-display text-2xl font-bold tabular-nums">{label}</span>
    </GameKey>
  );
}
