import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../ui/cn';

type Tone = 'accent' | 'neutral' | 'danger';

const TONE: Record<Tone, string> = {
  accent:  'bg-surface-accent text-content-on-accent hover:brightness-110',
  neutral: 'bg-surface-overlay text-content-primary hover:bg-surface-muted',
  danger:  'bg-score-down-soft text-score-down-text hover:brightness-110',
};

export interface GameKeyProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  /** Hero label, rendered in the display face (e.g. a number). Adds vertical padding. */
  label?: ReactNode;
  /** Small caption under the hero label. */
  sublabel?: ReactNode;
}

/**
 * Large tactile key shared by scoreboard games. Provide `label` (+ optional
 * `sublabel`) for the common numeric-key case — it renders a stacked face with
 * its own `py-5`. Pass `children` for custom content (e.g. a wide "Brak
 * trafienia" key, or a numpad key inside a `flex-1` grid cell) — no padding is
 * forced, so the caller/grid controls height.
 */
export const GameKey = forwardRef<HTMLButtonElement, GameKeyProps>(function GameKey(
  { tone = 'accent', label, sublabel, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl transition active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-content-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base',
        'disabled:pointer-events-none disabled:opacity-40',
        label != null && 'py-5',
        TONE[tone],
        className,
      )}
      {...rest}
    >
      {label != null ? (
        <>
          <span className="font-display text-3xl font-extrabold leading-none tabular-nums">{label}</span>
          {sublabel && (
            <span className="mt-1 text-xs font-medium uppercase tracking-wider opacity-70">{sublabel}</span>
          )}
        </>
      ) : children}
    </button>
  );
});

export default GameKey;
