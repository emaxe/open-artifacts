import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { XIcon } from "./icons";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * A modal built on the native <dialog> element instead of a hand-rolled portal + focus-trap +
 * scroll-lock stack. `showModal()` gives us the top layer, an automatic ::backdrop, focus
 * trapping, and Esc-to-close for free — this is the whole reason a Radix-style dependency isn't
 * needed for something this small.
 */
export function Dialog({ open, onClose, title, children, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // The native "cancel" event fires on Esc before "close" — handling it lets us always go through
  // the same onClose callback regardless of how the dialog was dismissed.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener("cancel", handleCancel);
    return () => el.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    // The dialog element itself is sized to its content by our CSS; a click that lands on the
    // element but outside every child is therefore a ::backdrop click.
    if (e.target === ref.current) onClose();
  }

  return (
    <dialog
      ref={ref}
      onClick={handleBackdropClick}
      onClose={onClose}
      className={cn("m-auto w-full max-w-md rounded-card border border-border bg-panel p-0 text-fg backdrop:bg-black/50", className)}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Закрыть" className="text-muted hover:text-fg">
          <XIcon size={16} />
        </button>
      </div>
      <div className="p-4">{children}</div>
    </dialog>
  );
}
