import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/** The one live thing on the page: the visitor's own domain, echoed in the hero link, the terminal and the artifact panel. */
interface DomainState {
  /** What the visitor typed (may be empty). */
  value: string;
  setValue: (next: string) => void;
  /** Always printable: the typed host, or the placeholder when the field is empty. */
  host: string;
  /** Sample short link shown across the page. */
  link: string;
}

const SAMPLE_TOKEN = "9kQ2xR";
const DEFAULT_HOST = "your-server.com";

const DomainContext = createContext<DomainState | null>(null);

/** Strips scheme, path and whitespace so "https://Foo.com/bar" and "foo.com" render the same. */
function normalizeHost(raw: string): string {
  return raw
    .trim()
    .replace(/^[a-z]+:\/\//i, "")
    .replace(/[/?#].*$/, "")
    .replace(/\s+/g, "")
    .slice(0, 48);
}

export function DomainProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState("");
  const state = useMemo<DomainState>(() => {
    const host = normalizeHost(value) || DEFAULT_HOST;
    return { value, setValue, host, link: `https://${host}/s/${SAMPLE_TOKEN}` };
  }, [value]);
  return <DomainContext.Provider value={state}>{children}</DomainContext.Provider>;
}

export function useDomain(): DomainState {
  const ctx = useContext(DomainContext);
  if (!ctx) throw new Error("useDomain must be used within DomainProvider");
  return ctx;
}
