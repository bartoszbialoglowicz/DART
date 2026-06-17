import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";

type ModalSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

const FOCUSABLE =
  'a[href],area[href],button:not([disabled]),input:not([disabled]),' +
  'select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const noop = () => {};

export interface ModalProps {
  /** Visible state. Omit to use the "mounted = open" pattern (defaults true). */
  open?: boolean;
  /** Close request (Esc, overlay, close button). Omit for non-dismissable modals. */
  onClose?: () => void;
  /** Title rendered in the default header. Omit to build a custom header in children. */
  title?: ReactNode;
  /** Accessible name when there is no visible title. */
  ariaLabel?: string;
  description?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  size?: ModalSize;
  /** Show the default header close (X). Defaults to true when a title is present. */
  showClose?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement>;
}

export function Modal({
  open = true,
  onClose = noop,
  title,
  ariaLabel,
  description,
  footer,
  children,
  size = "md",
  showClose,
  closeOnOverlayClick = true,
  closeOnEsc = true,
  initialFocusRef,
}: ModalProps) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const titleId = useId();
  const descId = useId();
  const resolvedShowClose = showClose ?? Boolean(title);
  const hasHeader = Boolean(title || resolvedShowClose);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), 200);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mounted]);

  // Capture focus on open; restore it on close or unmount.
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    return () => {
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!shown) return;
    const target = initialFocusRef?.current ?? panelRef.current;
    target?.focus();
  }, [shown, initialFocusRef]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape" && closeOnEsc) {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [closeOnEsc, onClose],
  );

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      aria-hidden={!open}
    >
      <div
        className={cn(
          "absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-200 ease-out motion-reduce:transition-none",
          shown ? "opacity-100" : "opacity-0",
        )}
        onClick={closeOnOverlayClick ? onClose : undefined}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={!title ? ariaLabel : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cn(
          "relative flex max-h-full w-full flex-col rounded-xl border border-border-subtle bg-surface-overlay shadow-2xl shadow-black/40 outline-none",
          "transition duration-200 ease-out motion-reduce:transition-none motion-reduce:transform-none",
          SIZE_CLASS[size],
          shown
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-1 scale-95 opacity-0",
        )}
      >
        {hasHeader && (
          <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
            <div className="min-w-0">
              {title && (
                <h2
                  id={titleId}
                  className="truncate text-lg font-semibold tracking-tight text-content-primary"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="mt-1 text-sm text-content-secondary">
                  {description}
                </p>
              )}
            </div>

            {resolvedShowClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Zamknij"
                className="-mr-1.5 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-content-secondary transition-colors hover:bg-surface-muted hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-content-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-overlay"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </header>
        )}

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-6 text-content-primary",
            hasHeader ? "pt-0" : "pt-5",
            footer ? "pb-4" : "pb-5",
          )}
        >
          {children}
        </div>

        {footer && (
          <footer className="flex items-center justify-end gap-3 border-t border-border-subtle px-6 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default Modal;
