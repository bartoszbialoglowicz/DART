import type { ReactNode } from 'react';
import { Badge } from '../ui/Badge';

export function PendingBadge() {
  return <Badge variant="rank">PENDING</Badge>;
}

export function EmptyMsg({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-overlay px-4 py-10 text-center text-sm text-content-secondary">
      {children}
    </div>
  );
}
