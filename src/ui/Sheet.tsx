import { useEffect, useId, useRef, type ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Extra class, e.g. "sheet--tall" for a sheet with a scrolling list. */
  className?: string;
  children: ReactNode;
};

/** A bottom sheet for confirmations only. Tapping the scrim or pressing Escape closes it. */
export function Sheet({ open, onClose, title, className, children }: Props) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  // Kept in a ref so a parent re-render (the workout timer ticks every second) doesn't re-run the focus effect.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div
        ref={ref}
        className={className ? `sheet ${className}` : "sheet"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="sheet__title">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
