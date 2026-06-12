import { useEffect, useRef } from 'react';

type ModalSize = 'sm' | 'md' | 'lg';

interface Props {
  children:  React.ReactNode;
  onClose?:  () => void;       // undefined → blokujący (brak możliwości zamknięcia)
  size?:     ModalSize;
  'aria-labelledby'?: string;
}

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: 'max-w-md',   // ~448px  — auth, setup
  md: 'max-w-xl',   // ~576px  — turniej konfiguracja
  lg: 'max-w-2xl',  // ~672px  — turniej gracze, liga
};

export function Modal({ children, onClose, size = 'md', 'aria-labelledby': labelId }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ESC
  useEffect(() => {
    if (!onClose) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (onClose && e.target === overlayRef.current) onClose();
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelId}
    >
      {/* Centering wrapper — items-center na sm+, items-end na xs (sheet-like) */}
      <div className="flex min-h-full items-end justify-center p-4 sm:items-center sm:p-6">
        <div className={`w-full ${SIZE_CLASS[size]} rounded-2xl border border-border-subtle bg-surface-overlay shadow-2xl`}>
          {children}
        </div>
      </div>
    </div>
  );
}
