import type { ReactNode } from 'react';
import { Button } from '../ui/Button';

type Props = {
  title:       string;
  /** Optional node beside the title — typically a mode <Badge>. */
  badge?:      ReactNode;
  onClose:     () => void;
  closeLabel?: string;
  /** Optional secondary header action, rendered to the left of the close button
   *  (e.g. a standalone "Zakończ" that ends the session instead of just leaving). */
  extraAction?: ReactNode;
  /** Body + key area + any overlays. */
  children:    ReactNode;
};

/**
 * Full-screen shell shared by keyboard/scoreboard games (501, Checkouts, …).
 * Owns the takeover container and header so individual games never re-roll
 * `fixed inset-0 z-50 …`. Game-specific overlays render as children and
 * position against this (it is the positioned ancestor).
 */
export function GameShell({ title, badge, onClose, closeLabel = 'Zamknij', extraAction, children }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface-base select-none">
      <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-widest text-content-secondary">{title}</span>
          {badge}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {extraAction}
          <Button variant="secondary" size="sm" onClick={onClose}>{closeLabel}</Button>
        </div>
      </div>
      {children}
    </div>
  );
}
