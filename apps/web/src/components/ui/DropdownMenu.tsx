import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { MoreHorizontalIcon } from "./icons";

export interface DropdownMenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export interface DropdownMenuProps {
  items: DropdownMenuItem[];
  trigger?: ReactNode;
  align?: "left" | "right";
  label?: string;
}

/**
 * A small popover menu with the a11y bits a row of action buttons doesn't need to reinvent per
 * table: click-outside close, Esc close, and arrow-key roving focus among the items. This is the
 * one primitive in the set with real accessibility cost — everything else is a styled native
 * element.
 */
export function DropdownMenu({ items, trigger, align = "right", label = "Действия" }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      const enabled = items.map((item, i) => ({ item, i })).filter(({ item }) => !item.disabled);
      if (enabled.length === 0) return;
      const currentIndex = itemRefs.current.findIndex((el) => el === document.activeElement);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const pos = enabled.findIndex(({ i }) => i === currentIndex);
        const nextPos = e.key === "ArrowDown" ? (pos + 1) % enabled.length : (pos - 1 + enabled.length) % enabled.length;
        const nextIndex = pos === -1 ? enabled[0]!.i : enabled[nextPos]!.i;
        itemRefs.current[nextIndex]?.focus();
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, items]);

  useEffect(() => {
    if (open) itemRefs.current.find((el) => el && !el.disabled)?.focus();
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-8 items-center justify-center rounded-control text-muted hover:bg-panel-muted hover:text-fg"
      >
        {trigger ?? <MoreHorizontalIcon size={16} />}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute top-full z-20 mt-1 min-w-40 rounded-control border border-border bg-panel py-1 shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((item, i) => (
            <button
              key={item.label}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                "block w-full px-3 py-1.5 text-left text-sm hover:bg-panel-muted disabled:opacity-50 disabled:cursor-not-allowed",
                item.danger ? "text-danger" : "text-fg",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
