import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import { SearchIcon, XIcon } from "./icons";

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Debounce delay in ms before `onChange` fires. */
  debounceMs?: number;
}

/** A search box that debounces before calling `onChange`, so callers can wire it straight to a server query. */
export function SearchInput({ value, onChange, placeholder = "Поиск…", className, debounceMs = 300 }: SearchInputProps) {
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Keep the draft in sync if the value is reset from outside (e.g. a "clear filters" action).
  useEffect(() => {
    setDraft(value);
  }, [value]);

  function handleChange(next: string) {
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(next), debounceMs);
  }

  function handleClear() {
    if (timer.current) clearTimeout(timer.current);
    setDraft("");
    onChange("");
  }

  return (
    <div className={cn("relative", className)}>
      <SearchIcon size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-control border border-border bg-panel py-1.5 pr-8 pl-8 text-sm text-fg placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring max-md:h-11"
      />
      {draft && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Очистить"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-fg"
        >
          <XIcon size={14} />
        </button>
      )}
    </div>
  );
}
