import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Card } from "./Card";
import { Input } from "./Input";
import { cn } from "./cn";

type Layout = "inline" | "compact";

// fillViewport: never shrink below the fixed inline height (h-96 = 384px)…
const FILL_MIN_HEIGHT = 384;
// …and leave room under the picker for a footer action row (e.g. a wizard's
// Wstecz/Dalej bar) plus the page's bottom padding and a small margin.
const FILL_BOTTOM_GAP = 120;

const LIST_HEIGHT: Record<Layout, string> = {
  // Laptop: the picker is the main content of the step, give it room.
  inline: "h-96",
  // Inside a Modal on small screens.
  compact: "h-64",
};

export interface DualListPickerProps<T> {
  /** Items that can still be added, already filtered by the caller (search, mode, …). */
  available: T[];
  selected: T[];
  getKey: (item: T) => string | number;
  /** Row content (icon, name, meta). The picker owns the row chrome and add/remove controls. */
  renderItem: (item: T) => ReactNode;
  /** Accessible name of an item, used for the remove button label. */
  getLabel: (item: T) => string;
  /** Return false to reject (e.g. a limit is reached) — the search is then kept. */
  onAdd: (item: T) => boolean | void;
  onRemove: (item: T) => void;

  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;

  availableTitle: ReactNode;
  selectedTitle: ReactNode;
  /** Extra controls under the search box (e.g. a SegmentedControl filter). */
  toolbar?: ReactNode;
  /** Rendered under the selected list (e.g. an "add placeholder" input). */
  selectedFooter?: ReactNode;
  /** Short status line (e.g. limit reached), announced politely. */
  notice?: ReactNode;
  emptyAvailable?: ReactNode;
  emptySelected?: ReactNode;
  layout?: Layout;
  /**
   * Inline layout only: stretch down to the bottom of the viewport instead of
   * using a fixed list height (keeps room for a footer bar below).
   */
  fillViewport?: boolean;
  autoFocus?: boolean;
  className?: string;
}

/**
 * Two-list picker: searchable "available" list on the left, "selected" list on
 * the right. Keyboard-first — ↑/↓ move the highlight through the results,
 * Enter adds the highlighted item and clears the search for the next one,
 * Esc clears the search.
 */
export function DualListPicker<T>({
  available,
  selected,
  getKey,
  renderItem,
  getLabel,
  onAdd,
  onRemove,
  search,
  onSearchChange,
  searchPlaceholder,
  availableTitle,
  selectedTitle,
  toolbar,
  selectedFooter,
  notice,
  emptyAvailable = "Brak wyników.",
  emptySelected = "Nikt nie został jeszcze wybrany.",
  layout = "inline",
  fillViewport,
  autoFocus,
  className,
}: DualListPickerProps<T>) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [fillHeight, setFillHeight] = useState<number | null>(null);
  const filling = layout === "inline" && fillViewport;

  // Height = viewport bottom minus where the picker starts on the page. Re-run
  // when the window resizes or anything above it changes height (body resize).
  // Depends only on our top edge, so our own resize can't feed back into it.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!filling || !el) return;
    const update = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      setFillHeight(Math.max(FILL_MIN_HEIGHT, Math.round(window.innerHeight - top - FILL_BOTTOM_GAP)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(document.body);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [filling]);
  const [active, setActive] = useState(0);
  // Clamp rather than reset in an effect — the list shrinks as items are added.
  const activeIndex = available.length === 0 ? -1 : Math.min(active, available.length - 1);
  const optionId = (i: number) => `${listId}-opt-${i}`;

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(activeIndex + 1, available.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex < 0) return;
      if (onAdd(available[activeIndex]) === false) return;
      onSearchChange("");
      setActive(0);
    } else if (e.key === "Escape" && search) {
      e.preventDefault();
      onSearchChange("");
      setActive(0);
    }
  }

  const panel = "flex min-h-0 min-w-0 flex-col gap-3";
  const panelTitle = "text-xs font-semibold uppercase tracking-widest text-content-secondary";
  // The list sits on the card surface itself — the highlighted row lifts one
  // step to surface-muted, which a muted/base-filled well would swallow.
  const list = cn(
    "overflow-y-auto rounded-xl border border-border-subtle",
    filling ? "min-h-0 flex-1" : LIST_HEIGHT[layout],
  );

  return (
    <div
      ref={rootRef}
      style={filling && fillHeight != null ? { height: fillHeight } : undefined}
      className={cn("grid gap-4", layout === "inline" ? "lg:grid-cols-2" : "sm:grid-cols-2", className)}
    >
      {/* Available */}
      <Card padding="sm" className={panel}>
        <p className={panelTitle}>{availableTitle}</p>
        <Input
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
          aria-autocomplete="list"
          autoFocus={autoFocus}
          value={search}
          onChange={e => { onSearchChange(e.target.value); setActive(0); }}
          onKeyDown={handleKeyDown}
          placeholder={searchPlaceholder}
        />
        {toolbar}
        <div id={listId} role="listbox" aria-label="Dostępni" className={list}>
          {available.length === 0 ? (
            <p className="px-4 py-3 text-sm text-content-secondary">{emptyAvailable}</p>
          ) : (
            available.map((item, i) => (
              <div
                key={getKey(item)}
                id={optionId(i)}
                role="option"
                aria-selected={i === activeIndex}
                onClick={() => onAdd(item)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 px-4 py-2 text-sm text-content-secondary transition-colors",
                  i === activeIndex && "bg-surface-muted text-content-primary",
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">{renderItem(item)}</div>
                <span aria-hidden className="text-base text-content-faint">+</span>
              </div>
            ))
          )}
        </div>
        {/* Keyboard hints only where a keyboard is likely (the inline, laptop layout). */}
        {layout === "inline" && (
          <p className="text-xs text-content-faint">↑ ↓ wybór · Enter dodaje · Esc czyści</p>
        )}
      </Card>

      {/* Selected */}
      <Card padding="sm" className={panel}>
        <p className={panelTitle}>{selectedTitle}</p>
        <div className={list}>
          {selected.length === 0 ? (
            <p className="px-4 py-3 text-sm text-content-secondary">{emptySelected}</p>
          ) : (
            selected.map(item => (
              <div key={getKey(item)} className="flex items-center gap-3 px-4 py-2">
                <div className="flex min-w-0 flex-1 items-center gap-3">{renderItem(item)}</div>
                <button
                  type="button"
                  onClick={() => onRemove(item)}
                  aria-label={`Usuń: ${getLabel(item)}`}
                  className="shrink-0 rounded p-1 text-content-secondary transition-colors hover:text-score-down-text"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
        {/* Live region stays mounted so the notice is announced when it appears. */}
        <p role="status" className="text-xs text-score-down-text empty:hidden">{notice}</p>
        {selectedFooter}
      </Card>
    </div>
  );
}

export default DualListPicker;
