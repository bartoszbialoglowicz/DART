import type { ReactNode } from 'react';

export function PendingBadge() {
  return (
    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">PENDING</span>
  );
}

export function EmptyMsg({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-white/3 px-4 py-10 text-center text-sm text-content-secondary">
      {children}
    </div>
  );
}
